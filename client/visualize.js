const decoder = new TextDecoder();
export default async function visualize(objects, elk, refs, indexEntries)
{
    const pathToCss= ref => ref.replace(/[\/.]/g, '-');

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
    for(const ref of refs) {
        const target = ref.target.startsWith("ref: ") ? pathToCss(ref.target.replace(/^ref: /,'')) : ref.target;
        const edges = backwardEdges.get(target) ?? [];
        edges.push(pathToCss(ref.ref));
        backwardEdges.set(target, edges);
    }
    for(const entry of indexEntries) {
        const edges = backwardEdges.get(entry.oid) ?? [];
        edges.push('index-' + pathToCss(entry.path));
        backwardEdges.set(entry.oid, edges);
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
    const port_id_for_incoming_index_to_blob = (oid) => `${oid}-in-blob`;
    const port_id_for_commit_from_tag = (oid) => `${oid}-in-tag`;
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
        [{
            id: `${object.oid}-target`,
            sources: [object.oid],
            targets: [port_id_for_commit_from_tag(object.object.object)],
            type: object.object.type,
            cssClass: `edge-from-${object.oid}`,
        }],
    };
    const iota = length => [...Array(length)].map((_, i) => i);
    const outsideEdges = new Map();
    const edgeInfoPerType = Object.fromEntries(TYPES.map(type => [type, {
        edges: new Map(),
        ports: new Map(),
    }]));
    const refPorts = new Map();
    const refEdges = new Map();
    const indexPorts = new Map();
    const objectPorts = new Map();
    const rootEdges = new Map();

    function addPortOrEdge(map, toAdd) {
        // toAdd.labels = [...(toAdd.labels ?? []), label(toAdd.id)].toReversed();
        if(map.has(toAdd.id)) {
            map.get(toAdd.id).cssClass += ' ' + toAdd.cssClass;
        } else {
            map.set(toAdd.id, toAdd);
        }
    }

    const textMeasurer = document.createElement("canvas").getContext("2d");
    textMeasurer.font = `16px 'Fixedsys Excelsior 3.01'`;
    const charWidth = textMeasurer.measureText('A').width;
    const LABEL_HEIGHT = 20;

    const label = (text, isContainer=false) => ({
        text,
        width: charWidth * (text.length + 2),
        height: LABEL_HEIGHT,
        "layoutOptions": {
            "nodeLabels.placement": `[H_CENTER, ${isContainer ? 'V_TOP' : 'V_CENTER'}, INSIDE]`,
        },
        isContainer,
        box: true,
    });

    for (const object of objects) {
        for (const edge of EDGES_FOR_TYPE[object.type](object)) {
            if(edge.type === object.type) {
                addPortOrEdge(edgeInfoPerType[object.type].edges, {
                    ...edge,
                    isEnd: true,
                });
            } else {
                const sourceSide = TYPES.indexOf(object.type) < TYPES.indexOf(edge.type) ? 'EAST' : 'WEST';
                const sourcePortId = `${edge.sources[0]}-type-source-port-${sourceSide}`;
                const targetSide = TYPES.indexOf(object.type) < TYPES.indexOf(edge.type) ? 'WEST' : 'EAST';
                const targetPortId = `${edge.targets[0]}-type-target-port-${targetSide}`;
                addPortOrEdge(edgeInfoPerType[object.type].ports, {
                    id: sourcePortId,
                    layoutOptions: {
                        'elk.port.side': sourceSide,
                        "elk.portConstraints": "FIXED_SIDE",
                    },
                    cssClass: edge.cssClass,
                });
                addPortOrEdge(edgeInfoPerType[object.type].edges, {
                    id: `${edge.sources[0]}-${sourcePortId}-edge`,
                    sources: edge.sources,
                    targets: [sourcePortId],
                    isEnd: false,
                    cssClass: edge.cssClass,
                });
                addPortOrEdge(outsideEdges, {
                    id: `${sourcePortId}-${targetPortId}-edge`,
                    sources: [sourcePortId],
                    targets: [targetPortId],
                    isEnd: false,
                    cssClass: edge.cssClass,
                });
                addPortOrEdge(edgeInfoPerType[edge.type].ports, {
                    id: targetPortId,
                    layoutOptions: {
                        'elk.port.side': targetSide,
                        "elk.portConstraints": "FIXED_SIDE",
                    },
                    cssClass: edge.cssClass,
                });
                addPortOrEdge(edgeInfoPerType[edge.type].edges, {
                    id: `${targetPortId}-${edge.targets[0]}-edge`,
                    sources: [targetPortId],
                    targets: edge.targets,
                    isEnd: true,
                    cssClass: edge.cssClass,
                });
            }
        }
    }

    let has_ref_object_edge = false;

    for(const {ref, target, type} of refs)
    {
        const cssClass = `edge-from-${pathToCss(ref)}`;
        if (target.startsWith("ref: ")) {
            // Symbolic ref
            const targetRef = target.replace(/^ref: /, '');
            // Don't add if it's dangling.
            if (refs.find(ref => ref.ref === targetRef)) {
                addPortOrEdge(refEdges, {
                    id: `${ref}-symbolic-edge`,
                    sources: [ref],
                    targets: [targetRef],
                    isEnd: true,
                    cssClass,
                });
            }
        } else {
            has_ref_object_edge = true;
            const refPortId = `${ref}-port`;
            const targetPortId = type === 'commit' ? port_id_for_commit_from_tag(target) : port_id_for_incoming(target);
            addPortOrEdge(refPorts, {
                id: refPortId,
                layoutOptions: {
                    'elk.port.side': 'EAST',
                },
                cssClass,
            });
            const objectPortId = `${target}-to-ref-port`;
            addPortOrEdge(objectPorts, {
                id: objectPortId,
                layoutOptions: {
                    'elk.port.side': 'WEST',
                },
                cssClass,
            });
            const objectTypePortId = `${target}-type-target-port-WEST`;
            addPortOrEdge(edgeInfoPerType[type].ports, {
                id: objectTypePortId,
                layoutOptions: {
                    'elk.port.side': 'WEST',
                },
                cssClass,
            });
            addPortOrEdge(refEdges, {
                id: `${ref}-${refPortId}-edge`,
                sources: [ref],
                targets: [refPortId],
                isEnd: false,
                cssClass,
            });
            addPortOrEdge(rootEdges, {
                id: `${refPortId}-${objectPortId}-edge`,
                sources: [refPortId],
                targets: [objectPortId],
                isEnd: false,
                cssClass,
            });
            addPortOrEdge(outsideEdges, {
                id: `${objectPortId}-${objectTypePortId}-edge`,
                sources: [objectPortId],
                targets: [objectTypePortId],
                isEnd: false,
                cssClass,
            });
            addPortOrEdge(edgeInfoPerType[type].edges, {
                id: `${objectTypePortId}-${targetPortId}-edge`,
                sources: [objectTypePortId],
                targets: [targetPortId],
                isEnd: true,
                cssClass,
            });
        }
    }
    let has_index_object_edge = false;
    for(const {path, oid} of indexEntries)
    {
        has_index_object_edge = true;
        const cssClass = `edge-from-index-${pathToCss(path)}`;
        const indexPortId = `${path}-index-port`;
        addPortOrEdge(indexPorts, {
            id: indexPortId,
            labels: [label(path)],
            layoutOptions: {
                'elk.port.side': 'WEST',
            },
            cssId: `thing-index-${pathToCss(path)}`,
            cssClass: `${cssClass} thing`,
        });
        const objectPortId = `${oid}-index-object-port`;
        addPortOrEdge(objectPorts, {
            id: objectPortId,
            layoutOptions: {
                'elk.port.side': 'EAST',
            },
            cssClass,
        });
        const blobPortId = `${oid}-index-blob-port`;
        addPortOrEdge(edgeInfoPerType.blob.ports, {
            id: blobPortId,
            layoutOptions: {
                'elk.port.side': 'EAST',
            },
            cssClass,
        });
        addPortOrEdge(rootEdges, {
            id: `${indexPortId}-${objectPortId}-edge`,
            sources: [indexPortId],
            targets: [objectPortId],
            isEnd: false,
            cssClass,
        });
        addPortOrEdge(outsideEdges, {
            id: `${objectPortId}-${blobPortId}-edge`,
            sources: [objectPortId],
            targets: [blobPortId],
            isEnd: false,
            cssClass,
        });
        const targetPortId = port_id_for_incoming_index_to_blob(oid);
        addPortOrEdge(edgeInfoPerType.blob.edges, {
            id: `${blobPortId}-${targetPortId}-edge`,
            sources: [blobPortId],
            targets: [targetPortId],
            isEnd: true,
            cssClass,
        });
    }

    const BLOB_MAX_CHARS = 30;
    const COMMIT_MAX_CHARS = 20;
    const TAG_MAX_CHARS = 20;

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
                width: Math.max(...[...indexPorts.values()].map(port => port.labels[0].width)) + 10,
                height: (indexPorts.size + 1) * LABEL_HEIGHT + 40,
                fill: '#DDF',
                // fillHeight: true,
                layoutOptions: {
                    'partitioning.partition': '0',
                    'portLabels.placement': "[INSIDE]",
                    "elk.portConstraints": "FIXED_ORDER",
                },
                ports: [
                    ...[...indexPorts.values()].map(port => ({
                        ...port,
                        labels: [{
                            ...port.labels[0],
                            width: Math.max(...[...indexPorts.values()].map(port => port.labels[0].width)),
                        }]
                    })),
                    {
                        id: 'index-left',
                        layoutOptions: {
                            "elk.port.side": "WEST",
                        },
                        labels: [{
                            text: ' ',
                            height: 40,
                            width: 0,
                        }]
                    },
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
                // fillHeight: true,
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
                    ...objectPorts.values(),
                ],
                children:
                [
                    {
                        id: 'tag',
                        width: 100,
                        height: 100,
                        // fillHeight: true,
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
                                width: charWidth * TAG_MAX_CHARS + 40,
                                height: LABEL_HEIGHT * 2 + 20,
                                fill: 'green',
                                cssId: 'thing-' + object.oid,
                                cssClass: 'thing',
                                labels: [
                                    label(object.oid.slice(0, 7).padEnd(TAG_MAX_CHARS)),
                                    label(object.object.message.slice(0,TAG_MAX_CHARS).padEnd(TAG_MAX_CHARS)),
                                ],
                                ports: [{
                                    id: port_id_for_incoming(object.oid),
                                    layoutOptions: {
                                        "elk.port.side": "WEST",
                                    },
                                }],
                            })),
                        edges: [...edgeInfoPerType.tag.edges.values()],
                        ports: [...edgeInfoPerType.tag.ports.values()],
                    },
                    {
                        id: 'commit',
                        width: 100,
                        height: 100,
                        // fillHeight: true,
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
                                cssId: 'thing-' + object.oid,
                                cssClass: 'thing',
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
                        edges: [...edgeInfoPerType.commit.edges.values()],
                        ports: [...edgeInfoPerType.commit.ports.values()],
                    },
                    {
                        id: 'tree',
                        width: 100,
                        height: 100,
                        // fillHeight: true,
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
                                    cssId: 'thing-' + object.oid,
                                    cssClass: 'thing',
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
                        edges: [...edgeInfoPerType.tree.edges.values()],
                        ports: [...edgeInfoPerType.tree.ports.values()],
                    },
                    {
                        id: 'blob',
                        width: 100,
                        height: 100,
                        // fillHeight: true,
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
                                cssId: 'thing-' + object.oid,
                                cssClass: 'thing',

                                labels: [label(object.oid.slice(0, 7).padEnd(BLOB_MAX_CHARS)), label(decoder.decode(object.object).slice(0, BLOB_MAX_CHARS).padEnd(BLOB_MAX_CHARS))],
                                ports: [
                                    {
                                        id: port_id_for_incoming(object.oid),
                                        layoutOptions: {
                                            "elk.port.side": "WEST",
                                        },
                                    },
                                    {
                                        id: port_id_for_incoming_index_to_blob(object.oid),
                                        layoutOptions: {
                                            "elk.port.side": "EAST",
                                        },
                                    },
                                ],
                            })),
                        edges: [...edgeInfoPerType.blob.edges.values()],
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

                    ...outsideEdges.values(),
                ],
            },
            {
                id: 'refs',
                labels: [label("refs", true)],
                width: 100,
                height: 100,
                fill: '#FDF',
                // fillHeight: true,
                layoutOptions: {
                    'partitioning.partition': '2',
                },
                edges: [...refEdges.values()],
                ports: [
                    {
                        id: 'refs-right',
                        layoutOptions: {
                            "elk.port.side": "EAST",
                        },
                    },
                    ...refPorts.values(),
                ],
                children: refs.map(({ref}) => ({
                    id: ref,
                    width: label(ref).width,
                    height: label(ref).height,
                    labels: [label(ref)],
                    cssClass: 'thing',
                    cssId: `thing-${pathToCss(ref)}`,
                })),
            },
        ],
        edges: [
            {
                id: 'index-objects',
                sources: ['index-left'],
                targets: ['objects-right'],
                hidden: true,
            },
            ...(has_ref_object_edge ? [] : [{
                id: 'objects-refs',
                sources: ['objects-left'],
                targets: ['refs-right'],
                hidden: true,
            }]),
            ...rootEdges.values(),
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
                <g>
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

    const things = [
        ...objects.map(x => x.oid),
        ...refs.map(x => pathToCss(x.ref)),
        ...indexEntries.map(x => `index-${pathToCss(x.path)}`),
    ];
    document.getElementById('graph').innerHTML = `
        <style>
            ${things.map(thing => `
                #graph:has(.thing:hover):not(:has(:where(${[...reachableTo(thing)].map(x => `#thing-${x}:hover`).join(',')}))) #thing-${thing} {
                    opacity: 0.2;
                }
                #graph:has(.thing:hover):has(:where(${[...reachableTo(thing)].map(x => `#thing-${x}:hover`).join(',')})) #thing-${thing} > g > rect {
                    stroke: blue;
                    stroke-width: 2px;
                }
                #graph:has(.thing:hover):not(:has(:where(${[...reachableTo(thing)].map(x => `#thing-${x}:hover`).join(',')}))) .edge-from-${thing} {
                    opacity: 0.2;
                }
                #graph:has(.thing:hover):has(:where(${[...reachableTo(thing)].map(x => `#thing-${x}:hover`).join(',')})) polyline.edge-from-${thing} {
                    stroke: blue;
                    stroke-width: 2px;
                }
                #graph:has(.thing:hover):has(:where(${[...reachableTo(thing)].map(x => `#thing-${x}:hover`).join(',')})) circle.edge-from-${thing} {
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
}