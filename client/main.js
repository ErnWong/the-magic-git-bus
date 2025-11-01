import { V86 } from "/v86/libv86.mjs";
import vmConfig from "/config/vm.js";
import { IMAGES_DIR, toV86Url } from "../config/paths.js";

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