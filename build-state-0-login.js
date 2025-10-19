#!/usr/bin/env node

import buildState from "./state-builder.js";

buildState({
    script: async function*({ emulator, delay, waitUntilNewTextEndsWith, waitUntilPrompt, run, save })
    {
        // Wait for boot menu
        await delay(4000);

        // Select fourth menu item in grub menu (to use serial console)
        console.log('Selecting menu item');
        const escape = '\x1b[';
        const down_key = `${escape}B`;
        emulator.serial0_send(`${down_key}${down_key}${down_key}${down_key}\n`);

        yield* waitUntilNewTextEndsWith("(automatic login)");
        yield* waitUntilPrompt();
        yield* run("clear");
        await save("0-login.bin");
    }
});
