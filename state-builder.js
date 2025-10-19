import path from "node:path";
import fs from "node:fs/promises";
import url from "node:url";
//import { V86 } from "./v86/libv86.mjs";
import { V86 } from "./v86/libv86-debug.mjs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const V86_ROOT = path.join(__dirname, "./");
const IMAGES_DIR = path.join(V86_ROOT, "images");

export default function buildState({ initialState, script })
{
    var emulator = new V86({
        wasm_path: "./v86/v86.wasm",
        bios: { url: path.join(V86_ROOT, "bios/seabios.bin") },
        vga_bios: { url: path.join(V86_ROOT, "bios/vgabios.bin") },
        autostart: true,
        memory_size: 512 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        cdrom: { url: path.join(IMAGES_DIR, "nixos.iso") },
        initial_state: initialState ? { url: path.join(IMAGES_DIR, initialState) } : undefined,
        //log_level: 0x004000, // LOG_SERIAL // 0, // LOG_NONE
        log_level: 0, // LOG_NONE
    });

    console.log("Now booting, please stand by ...");

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    function* waitUntilNewTextEndsWith(str)
    {
        let serial_text = "";
        while(!serial_text.endsWith(str))
        {
            serial_text += yield;
        }
    }

    function* waitUntilPrompt()
    {
        // We can't search the whole text since there will be ANSI escape characters
        // yield* waitUntilNewTextEndsWith("[root@gitbus:~]#");
        // So instead, search the text within:
        /*
        Note:
            [root@nixos:~]# echo $PS1
            \n\[\033[1;31m\][\[\e]0;\u@\h: \w\a\]\u@\h:\w]\$\[\033[0m\]
        */
        yield* waitUntilNewTextEndsWith("root");
        yield* waitUntilNewTextEndsWith("@");
        yield* waitUntilNewTextEndsWith("gitbus");
        yield* waitUntilNewTextEndsWith("#");
    }

    function* run(cmd)
    {
        emulator.serial0_send(cmd + '\n');
        yield* waitUntilPrompt();
    }

    async function save(filename)
    {
        emulator.serial0_send("sync;echo 3 >/proc/sys/vm/drop_caches\n");
        await delay(10 * 1000);
        const s = await emulator.save_state();
        const output_file = path.join(IMAGES_DIR, filename);
        await fs.writeFile(output_file, new Uint8Array(s));
        console.log("Saved as " + output_file);
    }

    const script_state = script({
        emulator,
        delay,
        waitUntilNewTextEndsWith,
        waitUntilPrompt,
        run,
        save,
    });
    // Run until the first yield so it can accept the first serial byte.
    script_state.next();

    emulator.add_listener("serial0-output-byte", async function(byte)
    {
        const c = String.fromCharCode(byte);
        process.stdout.write(c);
        const result = await script_state.next(c);
        if(result.done)
        {
            emulator.destroy();
        }
    });
}