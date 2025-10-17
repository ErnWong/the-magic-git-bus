import path from "node:path";
import fs from "node:fs/promises";
import url from "node:url";
import { V86 } from "./build/libv86.mjs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const V86_ROOT = path.join(__dirname, "./");
const OUTPUT_DIR = path.join(V86_ROOT, "images");

export default function buildState({ initialState, script }) {
    var emulator = new V86({
        bios: { url: path.join(V86_ROOT, "bios/seabios.bin") },
        vga_bios: { url: path.join(V86_ROOT, "bios/vgabios.bin") },
        autostart: true,
        memory_size: 512 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        network_relay_url: "<UNUSED>",
    });

    console.log("Now booting, please stand by ...");

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    function waitUntilNewTextEndsWith(str)
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
        const output_file = path.join(OUTPUT_DIR, filename);
        await fs.writeFile(output_file, new Uint8Array(s));
        console.log("Saved as " + output_file);
    }

    const script_state = script({ emulator, delay, waitUntilNewTextEndsWith, save });

    emulator.add_listener("serial0-output-byte", async function(byte)
    {
        const c = String.fromCharCode(byte);
        process.stdout.write(c);
        const result = script_state.next(c);
        if(result.done)
        {
            emulator.destroy();
        }
    });
}