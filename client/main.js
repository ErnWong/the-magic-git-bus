import { V86 } from "/v86/libv86.mjs";
import vmConfig from "/config/vm.js";
import { IMAGES_DIR, toV86Url } from "../config/paths.js";
import visualize from "./visualize.js";

const METHOD = '9p'; // '9p' | 'inotify'

const emulator = new V86({
    ...vmConfig,
    initial_state: { url: toV86Url(new URL("1-git-init.bin.zst", IMAGES_DIR)) },
    serial_container_xtermjs: document.getElementById('vm'),
});
window.emulator = emulator;

const fontLoaded = document.fonts.load(`16px 'Fixedsys Excelsior 3.01'`);

const emulatorStarted = new Promise(resolve => {
    emulator.add_listener("emulator-started", () => {
        resolve();
        emulator.serial0_send('clear\n');
    });
});

const fitAddon = new (FitAddon.FitAddon)();

Promise.allSettled([fontLoaded, emulatorStarted]).then(() => {
    // Why isn't setOption defined?
    emulator.serial_adapter.term._publicOptions.fontFamily = '"Fixedsys Excelsior 3.01"';
    emulator.serial_adapter.term._publicOptions.fontSize = 16;
    emulator.serial_adapter.term.loadAddon(fitAddon);

    setInterval(() => fitAddon.fit(), 300);
});

let emulatorBytesLoaded = 0;
let emulatorBytesTotal = 0;

emulator.add_listener("download-progress", function(e)
{
    emulatorBytesLoaded = e.loaded;
    emulatorBytesTotal = e.total;
    updateProgress();
});

const states = [
    {
        name: '1-git-init',
        text: 'init',
        downloading: true,
        bytesLoaded: 0,
        bytesTotal: 0,
        postLoadCommand: 'clear\n',
    },
    {
        name: '2-git-blobs',
        text: 'blob',
        downloading: true,
        bytesLoaded: 0,
        bytesTotal: 0,
        postLoadCommand: 'clear\n',
    },
    {
        name: '3-git-trees',
        text: 'tree',
        downloading: true,
        bytesLoaded: 0,
        bytesTotal: 0,
        postLoadCommand: 'clear\n',
    },
    {
        name: '4-git-commits',
        text: 'commit',
        downloading: true,
        bytesLoaded: 0,
        bytesTotal: 0,
        postLoadCommand: 'clear\n',
    },
    {
        name: '5-git-index',
        text: 'index',
        downloading: true,
        bytesLoaded: 0,
        bytesTotal: 0,
        postLoadCommand: 'clear\n',
    },
    {
        name: '6-git-tags',
        text: 'tag',
        downloading: true,
        bytesLoaded: 0,
        bytesTotal: 0,
        postLoadCommand: 'clear\n',
    },
    {
        name: '7-git-branches',
        text: 'branch',
        downloading: true,
        bytesLoaded: 0,
        bytesTotal: 0,
        postLoadCommand: 'clear\n',
    },
    {
        name: '8-git-annotated-tags',
        text: 'annotated tag',
        downloading: true,
        bytesLoaded: 0,
        bytesTotal: 0,
        postLoadCommand: 'clear\n',
    },
];
let restoring_state = false;
for(const state of states)
{
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'state-selection';
    radio.id = `state-selection-radio-${state.name}`;
    const button = document.createElement('label');
    button.setAttribute('for', radio.id);
    button.textContent = state.text;
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
        const http = new XMLHttpRequest();
        http.open('get', new URL(`${state.name}.bin.zst`, IMAGES_DIR), true);
        http.responseType = 'arraybuffer';
        const httpPromise = new Promise((resolve, reject) => {
            http.onload = () => resolve(http.response);
            http.onerror = event => reject(event);
        });
        http.onprogress = event => {
            state.bytesLoaded = event.loaded;
            state.bytesTotal = event.total;
            updateProgress();
        };
        http.send(null);
        const buffer = await httpPromise;
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
    document.getElementById("vm-button-tray").appendChild(radio);
    document.getElementById("vm-button-tray").appendChild(button);
}

function updateProgress() {
    const bytesLoaded = emulatorBytesLoaded + states.map(x => x.bytesLoaded).reduce((a, b) => a + b, 0);
    const bytesTotal = emulatorBytesTotal + states.map(x => x.bytesTotal).reduce((a, b) => a + b, 0);
    const done = emulatorStarted && states.every(x => !x.downloading);
    const percent = (bytesLoaded / bytesTotal * 100).toFixed(1) + '%';
    const inversePercent = (100 - bytesLoaded / bytesTotal * 100).toFixed(1) + '%';
    document.getElementById('loading-progress').dataset.loaded = bytesLoaded;
    document.getElementById('loading-progress').dataset.total = bytesTotal;
    // document.getElementById('loading-progress').dataset.progress = ((bytesLoaded / bytesTotal) * 100).toFixed(0) + '%';
    document.getElementById('loading-progress').dataset.done = done ? "true" : "false";
    document.getElementById('loading-bg').style.width = percent;
    document.getElementById('loading-positive').style.width = inversePercent;
    document.getElementById('loading-negative').style.width = percent;
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
                        isDirectory() { return type === 'dir'; },
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

        const elk = new ELK({
            defaultLayoutOptions: {
                "elk.portConstraints": "FIXED_SIDE",
            }
        });

        let previous = null;

        const setEquals = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

        setInterval(async () =>
        {
            if(!emulator?.fs9p?.SearchPath) return; // Not ready yet.

            const cache = {};
            const dir = 'root/repo';
            const oids = await Array.fromAsync(git.listAllObjects({ fs, cache, dir }));
            const objects = await Array.fromAsync(oids.map(oid => git.readObject({ fs, cache, oid, dir, format: 'parsed' })));
            const objectById = new Map(objects.map(object => [object.oid, object]));
            const pathExists = path => emulator.fs9p.SearchPath(path).id !== -1;
            const refs = await Array.fromAsync([
                ...(pathExists(`${dir}/.git/HEAD`) ? ['HEAD'] : []), // Ideally we should catch error later to avoid race, but I can't seem to catch error.
                ...(pathExists(`${dir}/.git/refs`) ? (await git.listRefs({ fs, cache, dir, filepath: 'refs' })).map(x => 'refs/' + x) : []),
            ]
                .map(async ref => ({
                    ref,
                    ...(oid => ({
                        target: oid,
                        type: objectById.get(oid)?.type ?? null,
                    }))(await git.resolveRef({ fs, dir, ref, depth: 1 })),
                })));
            const indexEntries = pathExists(`${dir}/.git/index`) ? await git.listFiles({ fs, cache, dir, fullEntry: true }) : [];

            const oidSet = new Set(objectById.keys());
            const refSet = new Set(refs.map(ref => `${ref.ref}==>${ref.target}`));
            const indexSet = new Set(indexEntries.map(entry => `${entry.path}==>${entry.oid}`));

            if (previous && setEquals(oidSet, previous.oidSet) && setEquals(refSet, previous.refSet) && setEquals(indexSet, previous.indexSet)) {
                return;
            }

            visualize(objects, elk, refs, indexEntries);

            previous = { oidSet, refSet, indexSet };
        }, 300);
    })();
}