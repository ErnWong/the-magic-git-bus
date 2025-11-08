import { V86 } from "/v86/libv86.mjs";
import vmConfig from "/config/vm.js";
import { IMAGES_DIR, toV86Url } from "../config/paths.js";

const METHOD = '9p'; // '9p' | 'inotify'

const emulator = new V86({
    ...vmConfig,
    initial_state: { url: toV86Url(new URL("1-git-init.bin", IMAGES_DIR)) },
    serial_container_xtermjs: document.getElementById('vm'),
});
window.emulator = emulator;

emulator.add_listener("emulator-started", () => {
    // Why isn't setOption defined?
    emulator.serial_adapter.term._publicOptions.fontFamily = '"Fixedsys Excelsior 3.01"';
    emulator.serial_adapter.term._publicOptions.fontSize = 16;
    emulator.serial0_send('clear\n');
});

const states = [
    {
        name: '0-login',
        downloading: true,
        postLoadCommand: 'clear\n',
    },
    {
        name: '1-git-init',
        downloading: true,
        postLoadCommand: 'clear\n',
    },
    {
        name: '2-git-blobs',
        downloading: true,
        postLoadCommand: 'clear\n',
    },
    {
        name: '3-git-trees',
        downloading: true,
        postLoadCommand: 'clear\n',
    },
    {
        name: '4-git-commits',
        downloading: true,
        postLoadCommand: 'clear\n',
    },
];
let restoring_state = false;
for(const state of states)
{
    const button = document.createElement('button');
    button.textContent = state.name;
    let started = emulator.cpu_is_running;
    function update()
    {
        button.disabled = state.downloading || restoring_state || !started;
    }
    emulator.add_listener("emulator-started", () => {
        started = true;
        update();
    });
    button.disabled = true;
    (async () => {
        const buffer = await (await fetch(new URL(`${state.name}.bin`, IMAGES_DIR))).arrayBuffer();
        button.addEventListener('click', async () => {
            restoring_state = true;
            update();
            await emulator.restore_state(buffer);
            emulator.serial0_send(state.postLoadCommand);
            restoring_state = false;
            update();
        });
        state.downloading = false;
        update();
    })();
    document.getElementById("vm").parentElement.appendChild(button);
}

if(METHOD === 'inotify')
{
    (() => {
        let text = ''; 
        emulator.add_listener('serial1-output-byte', byte => {
            const character = String.fromCharCode(byte);
            if(character == '\n')
            {
                try
                {
                    const git = JSON.parse(text);
                    document.getElementById('graph').textContent = JSON.stringify(git, null, 2);
                }
                catch(e)
                {
                }
                text = '';
            }
            else
            {
                text += character;
            }
        });
    })();
}

if(METHOD === '9p')
{
    (async () => {
        //git = (await import('/isomorphic-git.js')).default;
        const decoder = new TextDecoder();

        // https://pubs.opengroup.org/onlinepubs/7908799/xsh/sysstat.h.html
        const S_IFMT = 0xF000;
        const S_IFLNK = 0xA000;
        const S_IFREG = 0x8000;
        const S_IFDIR = 0x4000;

        const fs = {
            promises:
            {
                async readFile(path, options)
                {
                    const uint8array = await emulator.fs9p.read_file(path);
                    if(uint8array === null) throw { code: 'ENOENT' };
                    if(options.encoding === 'utf8')
                    {
                        return decoder.decode(uint8array);
                    }
                    return uint8array;
                },
                async readdir(path, _options)
                {
                    const children = emulator.fs9p.read_dir(path);
                    if(children === undefined) throw { code: 'ENOENT' };
                    return children;
                },
                async stat(path, _options)
                {
                    const p = emulator.fs9p.SearchPath(path);
                    if(p.id === -1) throw { code: 'ENOENT' };
                    const inode = emulator.fs9p.GetInode(p.id);
                    let type = 'file';
                    switch(inode.mode & S_IFMT)
                    {
                        case S_IFREG: type = 'file'; break;
                        case S_IFDIR: type = 'dir'; break;
                        case S_IFLNK: type = 'symlink'; break;
                        default:
                            console.warn('Unsupported file type', inode.mode & S_IFMT);
                            break;
                    }
                    return {
                        type,
                        mode: inode.mode,
                        size: inode.size,
                        ino: p.id,
                        mtimeMs: inode.mtime * 1000,
                        ctimeMs: inode.ctime * 1000,
                    };
                },
                async lstat(path, options)
                {
                    // Assume no symlinks.
                    this.stat(path, options);
                },

                async writeFile() { throw new Error('readonly'); },
                async unlink() { throw new Error('readonly'); },
                async mkdir() { throw new Error('readonly'); },
                async rmdir() { throw new Error('readonly'); },
                async readlink() { throw new Error('unimplemented'); },
                async symlink() { throw new Error('unimplemented'); },
                async chmod() { throw new Error('unimplemented'); },
            }
        };
        window.fs = fs;

        const graphDiv = document.getElementById('graph');

        const elk = new ELK({
            defaultLayoutOptions: {
                "elk.portConstraints": "FIXED_SIDE",
                //"spacing.portsSurrounding": "[top=0.0, left=0.0, bottom=0.0, right=0.0]",
                //"considerModelOrder.components": "MODEL_ORDER"
            }
            //'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        });

        setInterval(async () =>
        {
            const cache = {};
            const oids = await Array.fromAsync(git.listAllObjects({ fs, cache, dir: '' }));
            const objects = await Array.fromAsync(oids.map(oid => git.readObject({ fs, cache, oid, dir: '', format: 'parsed' })));

            const objectById = new Map(objects.map(object => [object.oid, object]));

            const forwardEdges = object => ({
                blob: () => [],
                tree: () => object.object.map(treeEntry => treeEntry.oid),
                commit: () => [
                    object.object.tree,
                    ...object.object.parent,
                ],
                tag: () => [object.object.object],
            })[object.type]();
            const backwardEdges = new Map();
            for(const object of objects) {
                for(const targetId of forwardEdges(object)) {
                    const edges = backwardEdges.get(targetId) ?? [];
                    edges.push(object.oid);
                    backwardEdges.set(targetId, edges);
                }
            }
            const reachableToOid = new Map();
            const reachableTo = oid => {
                if (reachableToOid.has(oid)) return reachableToOid.get(oid);
                const reachable = new Set([
                    oid,
                    ...(backwardEdges.get(oid) ?? []).flatMap(x => [
                        x,
                        ...reachableTo(x),
                    ])
                ]);
                reachableToOid.set(oid, reachable);
                return reachable;
            };

            const TYPES = ['tag', 'commit', 'tree', 'blob'];
            const port_id_for_incoming = (oid) => `${oid}-in`;
            const port_id_for_commit_from_tag = (oid) => `${oid}-in-tag`;
            const tree_entry_edge = (oid, treeEntry) =>
            ({
                id: port_id_for_tree_entry(oid, treeEntry),
                sources: [port_id_for_tree_entry(oid, treeEntry)],
                targets: [port_id_for_incoming(treeEntry.oid)],
            });
            const port_id_for_commit_tree = (oid) => `${oid}-tree`;
            const port_id_for_commit_parent = (oid, parentIndex) => `${oid}-parent-${parentIndex}`;
            const port_id_for_tree_entry = (oid, treeEntry) => `${oid}-${treeEntry.path}`;

            const EDGES_FOR_TYPE =
            {
                blob: _ => [],
                commit: object => [
                    {
                        id: port_id_for_commit_tree(object.oid) + '-edge',
                        sources: [port_id_for_commit_tree(object.oid)],
                        targets: [port_id_for_incoming(object.object.tree)],
                        type: 'tree',
                        cssClass: `edge-from-${object.oid}`,
                    },
                    ...object.object.parent.map((parent, parentIndex) =>
                    ({
                        id: port_id_for_commit_parent(object.oid, parentIndex) + '-edge',
                        sources: [port_id_for_commit_parent(object.oid, parentIndex)],
                        targets: [port_id_for_incoming(parent)],
                        type: 'commit',
                        cssClass: `edge-from-${object.oid}`,
                    })),
                ],
                tree: object => object.object.map(treeEntry =>
                ({
                    id: port_id_for_tree_entry(object.oid, treeEntry) + '-edge',
                    sources: [port_id_for_tree_entry(object.oid, treeEntry)],
                    targets: [port_id_for_incoming(treeEntry.oid)],
                    type: treeEntry.type,
                    cssClass: `edge-from-${object.oid}`,
                })),
                tag: object =>
                ({
                    id: `${object.oid}-target`,
                    sources: [object.oid],
                    targets: [port_id_for_commit_from_tag(object.object.object)],
                    type: object.object.type,
                    cssClass: `edge-from-${object.oid}`,
                }),
            };
            const iota = length => [...Array(length)].map((_, i) => i);
            const outsideEdges = [];
            const edgeInfoPerType = Object.fromEntries(TYPES.map(type => [type, {
                edges: [],
                ports: new Map(),
            }]));

            for (const object of objects) {
                for (const edge of EDGES_FOR_TYPE[object.type](object)) {
                    if(edge.type === object.type) {
                        edgeInfoPerType[object.type].edges.push({
                            ...edge,
                            isEnd: true,
                        });
                    } else {
                        const sourceSide = TYPES.indexOf(object.type) < TYPES.indexOf(edge.type) ? 'EAST' : 'WESET';
                        const sourcePortId = `${edge.sources[0]}-type-source-port-${sourceSide}`;
                        const targetSide = TYPES.indexOf(object.type) < TYPES.indexOf(edge.type) ? 'WEST' : 'EAST';
                        const targetPortId = `${edge.targets[0]}-type-target-port-${targetSide}`;
                        edgeInfoPerType[object.type].ports.set(sourcePortId, {
                            id: sourcePortId,
                            layoutOptions: {
                                'elk.port.side': sourceSide,
                                "elk.portConstraints": "FIXED_SIDE",
                            },
                            cssId: edge.cssId,
                            cssClass: edge.cssClass,
                        });
                        edgeInfoPerType[object.type].edges.push({
                            id: `${edge.sources[0]}-type-source-port-edge`,
                            sources: edge.sources,
                            targets: [sourcePortId],
                            isEnd: false,
                            cssId: edge.cssId,
                            cssClass: edge.cssClass,
                        });
                        outsideEdges.push({
                            id: `${edge.id}-outside`,
                            sources: [sourcePortId],
                            targets: [targetPortId],
                            isEnd: false,
                            cssId: edge.cssId,
                            cssClass: edge.cssClass,
                        });
                        edgeInfoPerType[edge.type].ports.set(targetPortId, {
                            id: targetPortId,
                            layoutOptions: {
                                'elk.port.side': targetSide,
                                "elk.portConstraints": "FIXED_SIDE",
                            },
                            cssId: edge.cssId,
                            cssClass: edge.cssClass,
                        });
                        edgeInfoPerType[edge.type].edges.push({
                            id: `${edge.targets[0]}-type-target-port-edge`,
                            sources: [targetPortId],
                            targets: edge.targets,
                            isEnd: true,
                            cssId: edge.cssId,
                            cssClass: edge.cssClass,
                        });
                    }
                }
            }

            const textMeasurer = document.createElement("canvas").getContext("2d");
            textMeasurer.font = `16px 'Fixedsys Excelsior 3.01'`;
            const charWidth = textMeasurer.measureText('A').width;

            const label = (text, isContainer=false) => ({
                text,
                width: charWidth * (text.length + 2),
                height: 20,
                "layoutOptions": {
                    "nodeLabels.placement": `[H_CENTER, ${isContainer ? 'V_TOP' : 'V_CENTER'}, INSIDE]`,
                },
                isContainer,
                box: true,
            });

            const BLOB_MAX_CHARS = 30;
            const COMMIT_MAX_CHARS = 20;

            const graph =
            {
                id: 'git',
                labels: [label(".git", true)],
                layoutOptions: {
                    'elk.direction': 'RIGHT',
                    "elk.portConstraints": "FIXED_SIDE",
                },
                fill: '#BBB',
                children: [
                    {
                        id: 'index',
                        labels: [label(".git/index", true)],
                        width: 100,
                        height: 100,
                        fill: '#DDF',
                        fillHeight: true,
                        layoutOptions: {
                            'partitioning.partition': '0',
                        },
                        ports: [
                            {
                                id: 'index-left',
                                layoutOptions: {
                                    "elk.port.side": "WEST",
                                },
                            }
                        ],
                    },
                    {
                        id: 'objects',
                        layoutOptions: {
                            'elk.direction': 'RIGHT',
                            "elk.portConstraints": "FIXED_SIDE",
                            'partitioning.partition': '1',
                        },
                        fill: '#DDD',
                        labels: [label(".git/objects", true)],
                        width: 100,
                        height: 100,
                        fillHeight: true,
                        ports: [
                            {
                                id: 'objects-left',
                                layoutOptions: {
                                    "elk.port.side": "WEST",
                                },
                            },
                            {
                                id: 'objects-right',
                                layoutOptions: {
                                    "elk.port.side": "EAST",
                                },
                            },
                        ],
                        children:
                        [
                            {
                                id: 'tag',
                                width: 100,
                                height: 100,
                                fillHeight: true,
                                layoutOptions: {
                                    'elk.direction': 'DOWN',
                                    "elk.portConstraints": "FIXED_SIDE",
                                },
                                labels: [label("Tags", true)],
                                fill: '#DFD',
                                children: objects
                                    .filter(object => object.type === 'tag')
                                    .map(object =>
                                    ({
                                        id: object.oid,
                                        width: 100,
                                        height: 100,
                                        fill: 'green',
                                        cssId: 'object-' + object.oid,
                                        cssClass: 'object',
                                        labels: [label(object.oid.slice(0, 7))],
                                        ports: [{
                                            id: port_id_for_incoming(object.oid),
                                            layoutOptions: {
                                                "elk.port.side": "WEST",
                                            },
                                        }],
                                    })),
                                edges: edgeInfoPerType.tag.edges,
                                ports: [...edgeInfoPerType.tag.ports.values()],
                            },
                            {
                                id: 'commit',
                                width: 100,
                                height: 100,
                                fillHeight: true,
                                layoutOptions: {
                                    'elk.direction': 'UP',
                                    "elk.portConstraints": "FIXED_SIDE",
                                },
                                labels: [label("Commits", true)],
                                fill: '#FFD',
                                children: objects
                                    .filter(object => object.type === 'commit')
                                    .map(object =>
                                    ({
                                        id: object.oid,
                                        width: label([...Array(COMMIT_MAX_CHARS).join(' ')]).width + 20,
                                        height: label([...Array(COMMIT_MAX_CHARS).join(' ')]).height * 2 + 20,
                                        fill: 'yellow',
                                        cssId: 'object-' + object.oid,
                                        cssClass: 'object',
                                        layoutOptions: {
                                            "elk.portConstraints": "FIXED_SIDE",
                                        },
                                        labels: [label(object.oid.slice(0, 7).padEnd(COMMIT_MAX_CHARS)), label(object.object.message.padEnd(COMMIT_MAX_CHARS))].toReversed(),
                                        ports: [
                                            {
                                                id: port_id_for_commit_tree(object.oid),
                                                layoutOptions: {
                                                    "elk.port.side": "EAST",
                                                    "elk.portConstraints": "FIXED_SIDE",
                                                },
                                            },
                                            {
                                                id: port_id_for_commit_from_tag(object.oid),
                                                layoutOptions: {
                                                    "elk.port.side": "WEST",
                                                },
                                            },
                                            {
                                                id: port_id_for_incoming(object.oid),
                                                layoutOptions: {
                                                    "elk.port.side": "SOUTH",
                                                },
                                            },
                                            ...object.object.parent.map((parent, parentIndex) =>
                                            ({
                                                id: port_id_for_commit_parent(object.oid, parentIndex),
                                                layoutOptions: {
                                                    "elk.port.side": "NORTH",
                                                    "elk.portConstraints": "FIXED_SIDE",
                                                },
                                                labels: [{ ...label('p' + parentIndex), box: false }],
                                            })),
                                        ],
                                    })),
                                edges: edgeInfoPerType.commit.edges,
                                ports: [...edgeInfoPerType.commit.ports.values()],
                            },
                            {
                                id: 'tree',
                                width: 100,
                                height: 100,
                                fillHeight: true,
                                layoutOptions: {
                                    'elk.direction': 'RIGHT',
                                    "elk.portConstraints": "FIXED_SIDE",
                                    'portLabels.placement': "[INSIDE]",
                                },
                                labels: [label("Trees", true)],
                                fill: '#FDD',
                                children: objects
                                    .filter(object => object.type === 'tree')
                                    .map(object => {
                                        const oidLabel = label(object.oid.slice(0, 7));
                                        const width = Math.max(...[
                                            oidLabel.width,
                                            ...object.object.map(treeEntry => label(treeEntry.path).width)
                                        ]);
                                        const totalHeight = [
                                            oidLabel.height,
                                            ...object.object.map(treeEntry => label(treeEntry.path).height)
                                        ].reduce((a, b) => a + b, 0);
                                        return {
                                            id: object.oid,
                                            fill: '#FAA',
                                            width: width + 10,
                                            height: totalHeight + 20,
                                            cssId: 'object-' + object.oid,
                                            cssClass: 'object',
                                            layoutOptions: {
                                                "elk.portConstraints": "FIXED_ORDER",
                                                'portLabels.placement': "[INSIDE]",
                                            },
                                            ports: [
                                                ...object.object.map(treeEntry =>
                                                ({
                                                    id: port_id_for_tree_entry(object.oid, treeEntry) + '-dummy',
                                                    labels: [{ ...label(treeEntry.path), width: 0, text: '' }],
                                                    layoutOptions: {
                                                        "elk.port.side": "WEST",
                                                    },
                                                })),
                                                {
                                                    id: port_id_for_incoming(object.oid),
                                                    labels: [oidLabel],
                                                    layoutOptions: {
                                                        "elk.port.side": "WEST",
                                                    },
                                                },
                                                {
                                                    id: port_id_for_incoming(object.oid) + '-dummy',
                                                    labels: [{ ...oidLabel, width: 0, text:'' }],
                                                    layoutOptions: {
                                                        "elk.port.side": "EAST",
                                                    },
                                                },
                                                ...object.object.map(treeEntry =>
                                                ({
                                                    id: port_id_for_tree_entry(object.oid, treeEntry),
                                                    labels: [{ ...label(treeEntry.path), width }],
                                                    layoutOptions: {
                                                        "elk.port.side": "EAST",
                                                    },
                                                })),
                                            ],
                                        };
                                    }),
                                edges: edgeInfoPerType.tree.edges,
                                ports: [...edgeInfoPerType.tree.ports.values()],
                            },
                            {
                                id: 'blob',
                                width: 100,
                                height: 100,
                                fillHeight: true,
                                layoutOptions: {
                                    'elk.direction': 'LEFT',
                                    "elk.portConstraints": "FIXED_SIDE",
                                },
                                labels: [label("Blobs", true)],
                                fill: '#DFF',
                                children: objects
                                    .filter(object => object.type === 'blob')
                                    .map(object =>
                                    ({
                                        id: object.oid,
                                        width: label([...Array(BLOB_MAX_CHARS).join(' ')]).width + 20,
                                        height: label([...Array(BLOB_MAX_CHARS).join(' ')]).height * 2 + 20,
                                        fill: 'cyan',
                                        cssId: 'object-' + object.oid,
                                        cssClass: 'object',

                                        labels: [label(object.oid.slice(0, 7).padEnd(BLOB_MAX_CHARS)), label(decoder.decode(object.object).slice(0, BLOB_MAX_CHARS).padEnd(BLOB_MAX_CHARS))],
                                        ports: [{
                                            id: port_id_for_incoming(object.oid),
                                            layoutOptions: {
                                                "elk.port.side": "WEST",
                                            },
                                        }],
                                    })),
                                edges: edgeInfoPerType.blob.edges,
                                ports: [...edgeInfoPerType.blob.ports.values()],
                            },
                        ],
                        edges:
                        [
                            ...iota(TYPES.length - 1).map(i => (
                               {
                                   id: `${TYPES[i]}-${TYPES[i + 1]}`,
                                   sources: [TYPES[i]],
                                   targets: [TYPES[i + 1]],
                                   hidden: true,
                               }
                            )),

                            ...outsideEdges,
                        ],
                    },
                    {
                        id: 'refs',
                        labels: [label(".git/refs", true)],
                        width: 100,
                        height: 100,
                        fill: '#FDF',
                        fillHeight: true,
                        layoutOptions: {
                            'partitioning.partition': '2',
                        },
                        ports: [
                            {
                                id: 'refs-right',
                                layoutOptions: {
                                    "elk.port.side": "EAST",
                                },
                            }
                        ],
                    },
                ],
                edges: [
                    {
                        id: 'index-objects',
                        sources: ['index-left'],
                        targets: ['objects-right'],
                        hidden: true,
                    },
                    {
                        id: 'objects-refs',
                        sources: ['objects-left'],
                        targets: ['refs-right'],
                        hidden: true,
                    },
                ]
            };
            window.graph = graph;

            const graphWithLayout = await elk.layout(graph);

            const FILL_X_PADDING = 10;
            const FILL_Y_PADDING_TOP = 40;
            const FILL_Y_PADDING_BOTTOM = 10;

            const toSvg = (node, parent, fillXOffset, fillYOffset) => `
                <g
                    ${node.cssClass ? `class="${node.cssClass}"` : ''}
                    ${node.cssId ? `id="${node.cssId}"` : ''}
                >
                    <g transform="translate(${node.fillWidth ? FILL_X_PADDING - fillXOffset : node.x}, ${node.fillHeight ? FILL_Y_PADDING_TOP - fillYOffset : node.y})">
                        <rect
                            width=${node.fillWidth ? parent?.width - 2 * FILL_X_PADDING ?? node.width : node.width}
                            height=${node.fillHeight ? parent?.height - FILL_Y_PADDING_TOP - FILL_Y_PADDING_BOTTOM ?? node.height : node.height}
                            stroke="black"
                            stroke-width="1"
                            fill="${node.fill ?? 'white'}"
                            style="filter: drop-shadow(4px 4px 0 rgba(0, 0, 0, 0.5))"
                        />
                        ${node.labels?.map(label => `
                            ${label.box ? `
                                <rect
                                    x=${label.isContainer ? 0 : label.x}
                                    y=${label.isContainer ? 0 : label.y}
                                    width=${label.isContainer ?
                                        (node.fillWidth ? parent?.width - 2 * FILL_X_PADDING ?? node.width : node.width)
                                        : label.width}
                                    height=${label.isContainer ? label.y * 2 + label.height : label.height}
                                    stroke="black"
                                    stroke-width="1"
                                    fill="${label.isContainer ? 'black' : 'white'}"
                                />
                            ` : ''}
                            <text style='font: ${textMeasurer.font}; fill: ${label.isContainer ? 'white' : 'black'}' x="${label.x + label.width / 2}" y="${label.y + label.height / 2}" text-anchor="middle" dominant-baseline="middle">${label.text ?? ''}</text>
                        `).join('') ?? ''}
                    </g>
                    <g transform="translate(${node.x}, ${node.y})">
                        ${node.children?.map(child => toSvg(child, node, node.fillWidth ? node.x - FILL_X_PADDING + fillXOffset : 0, node.fillHeight ? node.y - FILL_Y_PADDING_TOP + fillYOffset : 0)).join('') ?? ''}
                        ${node.ports?.map(child => toSvg(child, node, node.fillWidth ? node.x - FILL_X_PADDING + fillXOffset : 0, node.fillHeight ? node.y - FILL_Y_PADDING_TOP + fillYOffset : 0)).join('') ?? ''}
                        ${node.edges?.filter(edge => !edge.hidden).map(edge => `
                            ${edge.sections?.map(section => `
                                <polyline
                                    stroke="black"
                                    stroke-width="1"
                                    fill="none"
                                    ${edge.cssClass ? `class="${edge.cssClass}"` : ''}
                                    ${edge.cssId ? `id="${edge.cssId}"` : ''}
                                    ${edge.isEnd ? `marker-end="url(#arrow)"` : ''}
                                    points="${[section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(point => `${point.x},${point.y}`).join(' ')}"
                                />
                            `).join('') ?? ''}
                            ${edge.junctionPoints?.map(junction => `
                                <circle
                                    ${edge.cssClass ? `class="${edge.cssClass}"` : ''}
                                    ${edge.cssId ? `id="${edge.cssId}"` : ''}
                                    cx=${junction.x}
                                    cy=${junction.y}
                                    r="3"
                                    fill="black"
                                />
                            `).join('') ?? ''}
                        `).join('') ?? ''}
                    </g>
                </g>
            `;

            document.getElementById('graph').innerHTML = `
                <style>
                    ${objects.map(object => `
                        #graph:has(.object:hover):not(:has(:where(${[...reachableTo(object.oid)].map(x => `#object-${x}:hover`).join(',')}))) #object-${object.oid} {
                            opacity: 0.2;
                        }
                        #graph:has(.object:hover):has(:where(${[...reachableTo(object.oid)].map(x => `#object-${x}:hover`).join(',')})) #object-${object.oid} > g > rect {
                            stroke: blue;
                            stroke-width: 2px;
                        }
                        #graph:has(.object:hover):not(:has(:where(${[...reachableTo(object.oid)].map(x => `#object-${x}:hover`).join(',')}))) .edge-from-${object.oid} {
                            opacity: 0.2;
                        }
                        #graph:has(.object:hover):has(:where(${[...reachableTo(object.oid)].map(x => `#object-${x}:hover`).join(',')})) polyline.edge-from-${object.oid} {
                            stroke: blue;
                            stroke-width: 2px;
                        }
                        #graph:has(.object:hover):has(:where(${[...reachableTo(object.oid)].map(x => `#object-${x}:hover`).join(',')})) circle.edge-from-${object.oid} {
                            fill: blue;
                        }
                    `).join('\n')}
                </style>
                <svg width="${graphWithLayout.width + 20}" height="${graphWithLayout.height + 20}">
                    <defs>
                        <marker id="arrow" viewBox="-5 0 5 10" orient="auto-start-reverse" refX="5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse">
                            <path d="M -5 0 L 5 5 L -5 10 z" fill="black" />
                        </marker>
                    </defs>
                    <g transform="translate(10 10)">
                        ${toSvg(graphWithLayout, null, 0, 0)}
                    </g>
                </svg>
            `;
        }, 300);
    })();
}