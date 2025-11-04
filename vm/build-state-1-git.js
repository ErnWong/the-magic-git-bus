#!/usr/bin/env node

import buildState from "./state-builder.js";

buildState({
    initialState: "0-login.bin",
    script: async function*({ delay, run, save })
    {
        await delay(4000);
        yield* run("mkdir ~/repo");
        //yield* run("mount -t 9p -o trans=virtio,version=9p2000.L host9p ~/repo");
        yield* run("cd repo && git init");
        yield* run("git config --global user.name 'Charles Montgomery Plantagenet Schicklgruber Burns'");
        yield* run("git config --global user.email 'mr@burns.invalid'");
        yield* run("stream-git-dumps &");
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

        yield* run('echo tree 6db497f8ca5a8bf50591fd13beb12fc66dff1d31 > mycommit.txt');
        yield* run('echo "author Waylon Smithers <mr@smithers.invalid> 1762902000 +1300" >> mycommit.txt');
        yield* run('echo "committer Charles Montgomery Plantagenet Schicklgruber Burns <mr@burns.invalid> 1762902000 +1300" >> mycommit.txt');
        yield* run('echo "" >> mycommit.txt');
        yield* run('echo "My first commit" >> mycommit.txt');
        yield* run('git hash-object -t commit -w mycommit.txt');
        yield* run('git --no-pager show 02cbc162b0a74f3cbb90c6c7bcf7387b3033015b');

        yield* run('echo modified | git hash-object -w --stdin');
        yield* run('echo -e "100644 blob 2e0996000b7e9019eabcad29391bf0f5c7702f0b\\tcopy.txt" | git mktree');
        yield* run('echo -e "040000 tree 974cd135eb6c4da9d3f14e1de564f76a8a07234e\\tfolder');
        yield* run('100644 blob 3b18e512dba79e4c8300dd08aeb37f8e728b8dad\\tmyfile.txt');
        yield* run('100644 blob 323fae03f4606ea9991df8befbb2fca795e648fa\\totherfile.txt" | git mktree');
        yield* run('GIT_AUTHOR_DATE="2025-11-12T12:00:00+13" GIT_COMMITTER_DATE="2025-11-12T12:00:00+13" git commit-tree -p 02cbc162b0a74f3cbb90c6c7bcf7387b3033015b -m "Second commit!" 486a17fba0168a9242e39931c2b0233ada6a9671');
        yield* run('git --no-pager log 704cad9af4578d8f3248fe4c4e044014322f1154');
        yield* run('git --no-pager show 704cad9af4578d8f3248fe4c4e044014322f1154');

        await save("4-git-commits.bin");
    }
});
