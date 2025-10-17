#!/usr/bin/env node

import buildState from "./state-builder";

buildState({
    script: function*({ waitUntilNewTextEndsWith, save })
    {
        yield waitUntilNewTextEndsWith("[root@nixos:~]#");
        save("0-login.bin");
    }
});
