import path from "node:path";
import fs from "node:fs/promises";

import { V86 } from "../v86/libv86.mjs";

import { IMAGES_DIR, toV86Url } from "../config/paths.js";
import vmConfig from '../config/vm.js';

export default function buildState({ initialState, script })
{
    var emulator = new V86({
        ...vmConfig,
        initial_state: initialState ? { url: toV86Url(new URL(initialState, IMAGES_DIR)) } : undefined,
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
        //emulator.serial0_send("sync;echo 3 >/proc/sys/vm/drop_caches\n");
        //await delay(10 * 1000);
        const s = await emulator.save_state();
        const output_file = new URL(filename, IMAGES_DIR);
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