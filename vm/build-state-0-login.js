#!/usr/bin/env node

import buildState from "./state-builder.js";

buildState({
    script: async function*({ waitUntilNewTextEndsWith, waitUntilPrompt, run, save })
    {
        yield* waitUntilNewTextEndsWith("(automatic login)");
        yield* waitUntilPrompt();
        yield* run("clear");
        await save("0-login.bin");
    }
});
