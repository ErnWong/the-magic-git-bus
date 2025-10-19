#!/usr/bin/env node

import buildState from "./state-builder.js";

buildState({
    initialState: "0-login.bin",
    script: async function*({ delay, run, save })
    {
        await delay(4000);
        yield* run("mkdir ~/repo");
        yield* run("mount -t 9p -o trans=virtio,version=9p2000.L host9p ~/repo");
        yield* run("cd repo && git init");
        await save("1-git-init.bin");
    }
});
