#!/usr/bin/env node

// Based on https://github.com/copy/v86/blob/9735a0eed83a426b3b14cf98f9043a5a9241b142/tools/docker/alpine/build-state.js

import path from "node:path";
import fs from "node:fs/promises";
import url from "node:url";
import { V86 } from "./build/libv86.mjs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const V86_ROOT = path.join(__dirname, "./");
const OUTPUT_FILE = path.join(V86_ROOT, "images/state.bin");

var emulator = new V86({
    bios: { url: path.join(V86_ROOT, "bios/seabios.bin") },
    vga_bios: { url: path.join(V86_ROOT, "bios/vgabios.bin") },
    autostart: true,
    memory_size: 512 * 1024 * 1024,
    vga_memory_size: 8 * 1024 * 1024,
    network_relay_url: "<UNUSED>",
});

console.log("Now booting, please stand by ...");

let serial_text = "";
let booted = false;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

emulator.add_listener("serial0-output-byte", async function(byte)
{
    const c = String.fromCharCode(byte);
    //process.stdout.write(c);

    serial_text += c;

    if(!booted && serial_text.endsWith("localhost:~# "))
    {
        booted = true;

        emulator.serial0_send("sync;echo 3 >/proc/sys/vm/drop_caches\n");

        await delay(10 * 1000);

        const s = await emulator.save_state();

        await fs.writeFile(OUTPUT_FILE, new Uint8Array(s));
        console.log("Saved as " + OUTPUT_FILE);

        emulator.destroy();
    }
});