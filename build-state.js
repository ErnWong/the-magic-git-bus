#!/usr/bin/env node

// Based on https://github.com/copy/v86/blob/9735a0eed83a426b3b14cf98f9043a5a9241b142/tools/docker/alpine/build-state.js

import path from "node:path";
import fs from "node:fs/promises";
import url from "node:url";
import { V86 } from "./build/libv86.mjs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const V86_ROOT = path.join(__dirname, "./");
const OUTPUT_DIR = path.join(V86_ROOT, "images");

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

function* script()
{
    yield waitUntilNewTextEndsWith("[root@nixos:~]#");

    save("0-login.bin");

    emulator.serial0_send("mkdir ~/repo && echo done-make-repo\n");
    yield waitUntilNewTextEndsWith("done-make-repo");

    emulator.serial0_send("mount -t 9p -o trans=virtio,version=9p2000.L host9p ~/repo && done-mount-repo\n");
    yield waitUntilNewTextEndsWith("done-mount-repo");

    emulator.serial0_send("cd repo && git init && echo done-git-init\n");
    yield waitUntilNewTextEndsWith("done-git-init");

    save("1-git-init.bin");

    emulator.destroy();
}

const script_state = script();

emulator.add_listener("serial0-output-byte", async function(byte)
{
    const c = String.fromCharCode(byte);
    process.stdout.write(c);
    script_state.next(c);
});