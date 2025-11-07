import { V86 } from "/v86/libv86.mjs";
import vmConfig from "/config/vm.js";
import { IMAGES_DIR, toV86Url } from "../config/paths.js";

const METHOD = '9p'; // '9p' | 'inotify'

const emulator = new V86({
    ...vmConfig,
    initial_state: { url: toV86Url(new URL("0-login.bin", IMAGES_DIR)) },
    serial_container_xtermjs: document.getElementById('vm'),
});
window.emulator = emulator;

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
    function update()
    {
        button.disabled = state.downloading || restoring_state;
    }
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
            //'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        });

        setInterval(async () =>
        {
            const cache = {};
            const oids = await Array.fromAsync(git.listAllObjects({ fs, cache, dir: '' }));
            const objects = await Array.fromAsync(oids.map(oid => git.readObject({ fs, cache, oid, dir: '', format: 'parsed' })));
            const TYPES = ['tag', 'commit', 'tree', 'blob'];
            const tree_entry_edge = (oid, treeEntry) =>
            ({
                id: port_id_for_tree_entry(oid, treeEntry),
                sources: [port_id_for_tree_entry(oid, treeEntry)],
                targets: [treeEntry.oid],
            });
            const port_id_for_commit_tree = (oid) => `${oid}-tree`;
            const port_id_for_commit_parent = (oid, parentIndex) => `${oid}-parent-${parentIndex}`;
            const port_id_for_tree_entry = (oid, treeEntry) => `${oid}-${treeEntry.path}`;
            const PORTS_FOR_TYPE =
            {
                blob: _ => [],
                commit: object => [
                    {
                        id: port_id_for_commit_tree(object.oid),
                    },
                    ...object.object.parent.map((parent, parentindex) =>
                    ({
                        id: port_id_for_commit_parent(object.oid, parentindex),
                    })),
                ],
                tree: object => object.object.map(treeEntry =>
                ({
                    id: port_id_for_tree_entry(object.oid, treeEntry),
                })),
                tag: object => [],
            };
            const EDGES_FOR_TYPE =
            {
                blob: _ => [],
                commit: object => [
                    {
                        id: port_id_for_commit_tree(object.oid),
                        sources: [port_id_for_commit_tree(object.oid)],
                        targets: [object.object.tree],
                        type: 'tree',
                    },
                    ...object.object.parent.map((parent, parentIndex) =>
                    ({
                        id: port_id_for_commit_parent(object.oid, parentIndex),
                        sources: [port_id_for_commit_parent(object.oid, parentIndex)],
                        targets: [parent],
                        type: 'commit',
                    })),
                ],
                tree: object => object.object.map(treeEntry =>
                ({
                    id: port_id_for_tree_entry(object.oid, treeEntry),
                    sources: [port_id_for_tree_entry(object.oid, treeEntry)],
                    targets: [treeEntry.oid],
                    type: treeEntry.type,
                })),
                tag: object =>
                ({
                    id: `${object.oid}-target`,
                    sources: [object.oid],
                    targets: [object.object.object],
                    type: object.object.type,
                }),
            };
            //const iota = length => [...Array(length)].map((_, i) => i);
            const outsideEdges = [];
            const edgeInfoPerType = Object.fromEntries(TYPES.map(type => [type, {
                edges: [],
                ports: [],
            }]));

            for (const object of objects) {
                for (const edge of EDGES_FOR_TYPE[object.type](object)) {
                    if(edge.type === object.type) {
                        edgeInfoPerType[object.type].edges.push(edge);
                    } else {
                        edgeInfoPerType[object.type].ports.push({
                            id: `${edge.id}-type-source-port`,
                            layoutOptions: {
                                'elk.port.side': TYPES.indexOf(object.type) < TYPES.indexOf(edge.type) ? 'east' : 'west',
                                "elk.portConstraints": "FIXED_SIDE",
                            },
                        });
                        edgeInfoPerType[object.type].edges.push({
                            id: `${edge.id}-type-source-port-edge`,
                            sources: edge.sources,
                            targets: [`${edge.id}-type-source-port`],
                        });
                        outsideEdges.push({
                            id: `${edge.id}-outside`,
                            sources: [`${edge.id}-type-source-port`],
                            targets: [`${edge.id}-type-target-port`],
                        });
                        edgeInfoPerType[edge.type].ports.push({
                            id: `${edge.id}-type-target-port`,
                            layoutOptions: {
                                'elk.port.side': TYPES.indexOf(object.type) < TYPES.indexOf(edge.type) ? 'west' : 'east',
                                "elk.portConstraints": "FIXED_SIDE",
                            },
                        });
                        edgeInfoPerType[edge.type].edges.push({
                            id: `${edge.id}-type-target-port-edge`,
                            targets: [`${edge.id}-type-target-port`],
                            sources: edge.targets,
                        });
                    }
                }
            }

            const graph =
            {
                id: 'git',
                layoutOptions: {
                    //'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
                    'elk.direction': 'RIGHT',
                },
                children: [
                    {
                        id: 'objects',
                        layoutOptions: {
                            'elk.direction': 'RIGHT',
                        },
                        children:
                        [
                            {
                                id: 'tag',
                                width: 100,
                                layoutOptions: {
                                    'elk.direction': 'DOWN',
                                },
                                children: objects
                                    .filter(object => object.type === 'tag')
                                    .map(object =>
                                    ({
                                        id: object.oid,
                                        width: 100,
                                        height: 100,
                                    })),
                                edges: edgeInfoPerType.tag.edges,
                                ports: edgeInfoPerType.tag.ports,
                            },
                            {
                                id: 'commit',
                                width: 100,
                                layoutOptions: {
                                    'elk.direction': 'UP',
                                },
                                children: objects
                                    .filter(object => object.type === 'commit')
                                    .map(object =>
                                    ({
                                        id: object.oid,
                                        width: 100,
                                        height: 100,
                                        ports: [
                                            {
                                                id: port_id_for_commit_tree(object.oid),
                                                layoutOptions: {
                                                    "elk.port.side": "EAST",
                                                    "elk.portConstraints": "FIXED_SIDE",
                                                },
                                            },
                                            ...object.object.parent.map((parent, parentindex) =>
                                            ({
                                                id: port_id_for_commit_parent(object.oid, parentindex),
                                            })),
                                        ],
                                    })),
                                edges: edgeInfoPerType.commit.edges,
                                ports: edgeInfoPerType.commit.ports,
                            },
                            {
                                id: 'tree',
                                width: 100,
                                layoutOptions: {
                                    'elk.direction': 'RIGHT',
                                },
                                children: objects
                                    .filter(object => object.type === 'tree')
                                    .map(object =>
                                    ({
                                        id: object.oid,
                                        width: 100,
                                        height: 100,
                                        ports: object.object.map(treeEntry =>
                                        ({
                                            id: port_id_for_tree_entry(object.oid, treeEntry),
                                        })),
                                    })),
                                edges: edgeInfoPerType.tree.edges,
                                ports: edgeInfoPerType.tree.ports,
                            },
                            {
                                id: 'blob',
                                width: 100,
                                layoutOptions: {
                                    'elk.direction': 'DOWN',
                                },
                                children: objects
                                    .filter(object => object.type === 'blob')
                                    .map(object =>
                                    ({
                                        id: object.oid,
                                        width: 100,
                                        height: 100,
                                    })),
                                edges: edgeInfoPerType.blob.edges,
                                ports: edgeInfoPerType.blob.ports,
                            },
                        ],
                        edges:
                        [
                            //...iota(TYPES.length - 1).map(i => (
                            //    {
                            //        id: `${TYPES[i]}-${TYPES[i + 1]}`,
                            //        sources: [TYPES[i]],
                            //        targets: [TYPES[i + 1]],
                            //    }
                            //)),

                            // ...objects
                            //     .filter(({ type }) => type === 'tree')
                            //     .flatMap(object => object.object
                            //         .filter(treeEntry => treeEntry.type !== 'tree')
                            //         .map(treeEntry => tree_entry_edge(object.oid, treeEntry))
                            //     ),
                            // ...objects
                            //     .filter(({ type }) => type === 'commit')
                            //     .map(object =>
                            //     ({
                            //         id: port_id_for_commit_tree(object.oid),
                            //         sources: [port_id_for_commit_tree(object.oid)],
                            //         targets: [object.object.tree],
                            //     })),
                            // ...objects
                            //     .filter(object => object.type === 'tag')
                            //     .filter(object => object.object.type !== 'tag')
                            //     .map(object => tag_edge(object)),
                            ...outsideEdges,
                        ],
                    },
                    {
                        id: 'refs',
                    },
                ],
                //edges: objects.flatMap(object => EDGES_FOR_TYPE[object.type](object)),
            };
            window.graph = graph;
            const graphWithLayout = await elk.layout(graph);

            const toSvg = node => `
                <g transform="translate(${node.x}, ${node.y})">
                    <rect
                        width=${node.width}
                        height=${node.height}
                        stroke="black"
                        stroke-width="1"
                        fill="none"
                    />
                    <text>${node.id.slice(0,7)}</text>
                    ${node.children?.map(child => toSvg(child)).join('') ?? ''}
                    ${node.edges?.flatMap(edge => edge.sections?.map(section => `
                        <polyline
                            stroke="black"
                            stroke-width"1"
                            fill="none"
                            points="${[section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(point => `${point.x},${point.y}`).join(' ')}"
                        />
                    `) ?? []).join('') ?? ''}
                </g>
            `;

            graphDiv.innerHTML = `
                <svg width="${graphWithLayout.width}" height="${graphWithLayout.height}">
                    ${toSvg(graphWithLayout)}
                </svg>
            `;
        }, 300);
    })();
}