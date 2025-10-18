import path from "node:path";
import fs from "node:fs/promises";
import url from "node:url";
import { V86 } from "./v86/libv86.mjs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const V86_ROOT = path.join(__dirname, "./");
const IMAGES_DIR = path.join(V86_ROOT, "images");

export default function buildState({ initialState, script })
{
    var emulator = new V86({
        wasm_path: "./v86/v86.wasm",
        bios: { url: path.join(V86_ROOT, "bios/seabios.bin") },
        //vga_bios: { url: path.join(V86_ROOT, "bios/vgabios.bin") },
        autostart: true,
        memory_size: 512 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        network_relay_url: "<NONE>", // If i give this <None> it errors with invalid URL, but I reach login state. If I make this empty string, I don't get type error about invalid url, but I get stuck in logging in to root?
        cdrom: { url: path.join(IMAGES_DIR, "nixos.iso") },
        initialState: initialState ? { url: path.join(IMAGES_DIR, initialState) } : undefined,
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

    async function save(filename)
    {
        emulator.serial0_send("sync;echo 3 >/proc/sys/vm/drop_caches\n");
        await delay(10 * 1000);
        const s = await emulator.save_state();
        const output_file = path.join(IMAGES_DIR, filename);
        await fs.writeFile(output_file, new Uint8Array(s));
        console.log("Saved as " + output_file);
    }

    const script_state = script({ emulator, delay, waitUntilNewTextEndsWith, save });
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