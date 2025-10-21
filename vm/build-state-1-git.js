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

        yield* run("git cat-file --batch-check --batch-all-objects"); // While this doesn't affect git state, run this anyway so it's available in bash history
        yield* run("echo hello world > myfile.txt");
        yield* run('git hash-object -t blob myfile.txt');
        yield* run('cat myfile.txt | shasum');
        yield* run('echo -e "blob 12\\0hello world" > myblob');
        yield* run('cat myblob | shasum');
        yield* run('pigz --keep --zlib myblob');
        yield* run('mkdir .git/objects/3b');
        yield* run('mv myblob.zz .git/objects/3b/18e512dba79e4c8300dd08aeb37f8e728b8dad');
        yield* run("git cat-file --batch-check --batch-all-objects");
        yield* run('git cat-file -p 3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
        yield* run('echo foobar > otherfile.txt');
        yield* run('git hash-object -t blob -w otherfile.txt');
        yield* run('find .git/objects -type f');

        await save("2-git-blobs.bin");

        yield* run('echo -e -n "100644 copy.txt\\0" > childtree');
        yield* run('echo 3b18e512dba79e4c8300dd08aeb37f8e728b8dad | xxd -r -p >> childtree');
        yield* run('git hash-object -t tree -w childtree');

        yield* run('echo -e -n "40000 folder\\0" > mytree');
        yield* run('echo 8209f53524b4818a6d18424613de08c1c6552f11 | xxd -r -p >> mytree');
        yield* run('echo -e -n "100644 myfile.txt\\0" >> mytree');
        yield* run('echo 3b18e512dba79e4c8300dd08aeb37f8e728b8dad | xxd -r -p >> mytree');
        yield* run('echo -e -n "100644 otherfile.txt\\0" >> mytree');
        yield* run('echo 323fae03f4606ea9991df8befbb2fca795e648fa | xxd -r -p >> mytree');
        yield* run('git hash-object -t tree -w mytree');

        yield* run('git ls-tree 6db497f8ca5a8bf50591fd13beb12fc66dff1d31');
        yield* run('git ls-tree -r 6db497f8ca5a8bf50591fd13beb12fc66dff1d31');

        await save("3-git-trees.bin");
    }
});
