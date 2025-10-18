#!/usr/bin/env node

import buildState from "./state-builder.js";

buildState({
    initialState: "0-login.bin",
    script: async function*({ emulator, waitUntilNewTextEndsWith, save })
    {
        emulator.serial0_send("mkdir ~/repo && echo done-make-repo\n");
        yield* waitUntilNewTextEndsWith("done-make-repo");

        emulator.serial0_send("mount -t 9p -o trans=virtio,version=9p2000.L host9p ~/repo && done-mount-repo\n");
        yield* waitUntilNewTextEndsWith("done-mount-repo");

        emulator.serial0_send("cd repo && git init && echo done-git-init\n");
        yield* waitUntilNewTextEndsWith("done-git-init");

        await save("1-git-init.bin");
    }
});
