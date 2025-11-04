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
        window.git = git;
        window.fs = fs;
    })();
}