
Is this everyone? Good.

Welcome aboard the magic git bus.

First, a quick health and safety briefing as we start our field trip.

Take a look around your seat, aka the screen in front of you, that we have installed on our bus.

If you ever find yourself lost, we have a navigation map on the bottom showing where we are in this trip and what's top come. By default, your location will be synchronized with me, the tour guide, but if at any point you want to exercise your free will and explore other pages, click the "I have free will" button. To return to where I am presenting, click the "relinquish free will" button.

Now, let me bring your attention to the bottom right window. This is the terminal window. During this trip we'll be going past a variety of different git entities, and as you learn about them, you get to interact with these git entities through this terminal window. Please be reassured that this is only a simulated environment for your safety, and whatever you do inside this window, it won't affect the real world. If you ever get stuck, or if the terminal breaks, feel free to click on the big red emergency reset button. This will realign the simulated world back to one of our hand-crafted checkpoints.

Your seat also comes installed with a powerful visualization module. On the top right, there are two modes: File Explorer mode, and graph mode. These analyse what's going on in your simulated terminal window. During our trip, we will make frequent use of these visualizations.

At this point, you may be wondering, how is the bus able to drive through water. Now, that is a very good question. However, I must sadly inform you that there is a far more important question we have to answer, which brings us to the topic for today's trip.

"Why is my git merge broken, and how can I fix it"

I am afraid that we are currently not fully equipped to answer this question, and thus we must first dive deeper.

(Bus dives down)

"What is a merge",
"What is a branch",
"What is a commit".

Before we ask why, we need to know what the objects are that are participating in the question.

Now, objects, in our sense, what we're really talking about is the data structure behind git. The real meat and bones of it. The data structure gives us the lego bricks from which we can assemble houses and castles from. The data structure gives us the vocabulary and the language from which we talk and think about git.

I feel that this is an important point, because it was quite an important design decision made by the programmers to focus on the data structure rather than the algorithm.

Now, as with any talk, the cheap way to make it sound more pretentious is to chuck in some quotes.

Fred Brooks, the guy behind "The Mythical Man-Month", once said in that book:
> Show me your flowcharts and conceal your tables, and I shall continue to be mystified.
> Show me your tables, and I won’t usually need your flowcharts; they’ll be obvious.

And this idea is carried forward into the unix philosophy as one of its rules:

> Rule of Representation: Fold knowledge into data so program logic can be stupid and robust.

And welp, to hear it from the creator of git himself, Linus Torvalds:

> Bad programmers worry about the code. Good programmers worry about data structures and their relationships.

> git actually has a simple design, with stable and reasonably well-documented data structures.
> In fact, I'm a huge proponent of designing your code around the data, rather than the other way around,
> and I think it's one of the reasons git has been fairly successful […] I will, in fact, claim that the
> difference between a bad programmer and a good one is whether he considers his code or his data
> structures more important.

So let's try disect our language we use when we talk about git, and see if we can figure out git's data structure from first principles.

The driving question was "Why is my git merge broken", so we're interested in the behaviour of git merges. What is a merge? Well, when we talk about merging we talk about merging a branch into another branch.

What is a branch. That's actually an interesting question with a non-obvious answer that we'll come back to, but when we think about a branch, we're usually thinking about these things called commits, commits that quote-unquote belong to a branch or another.

What is a commit. The way we use the word commit is that, we'd do some work, you know, we'll make some changes to some files, and then we shout "commit!" at the terminal, or git client, or something like that. In a sense we're associating two ideas with the word commit: (1) the unit of work we did, i.e. the changes we've made, and (2) the moment in time we shouted the word "commit!" and how the rest of the codebase looks at that moment in time.

How the codebase looks at the moment in time - how do we describe that? Well, files and folders and their contents. Cool, and I think we've reached a stopping point once we've reached file contents - things. What is a thing.

Let's call a thing - an object.

# Objects

Reference: https://git-scm.com/book/en/v2/Git-Internals-Git-Objects

As you imagine, a project has many things, so we will have many objects. Let's have a folder to store them: `.git/objects`

## Blobs

Let's look at the first kind of thing - the blob. You can imagine, if we a file whos contents we want to store in a version control system, we'd have an object representing that file's data. We call that a blob.

Does a blob contain the file's filename? No. If you rename the file, the file's contents is still the same. If you copy the file, the two files still have the same data. So it makes sense to identify and address the blob in terms of its contents. Aka, a Content-Addressable-Storage.

So what git does is it calculates a hash of the contents as uses that as the identifier for the object. The name of the object is its contents. If you change the data, then, well, it's no longer the same data anymore. Objects are immutable and have value semantics. It's like how we treat other values in programming. The number 1 is not the same as the number 2. You can increment the number 1 to obtain a new number, but you can never change what the value the number '1' represents. When we refer to an object, we think of them as their value, rather than a variable. A variable would be more like a box with a name on it, a kind of memory cell, where you can put numbers and change them, but in contrast a value is a value is a value.

As you can imagine, that's quite a nice semantics to have when we're talking about a version control system - to know that things we refer to in the past will never change.

Let's try create a blob object. Feel free to follow along in your terminals.

We have an empty git repository. If you list all objects, you will see there's none

``` bash
git cat-file --batch-check --batch-all-objects
```

and when you look under .git/objects, there are indeed no objects. Ignore the info and pack directories.

Let's create a file

``` bash
echo hello world > myfile.txt
```

Let's figure out the hash for it

```bash
git hash-object -t blob myfile.txt

# 3b18e512dba79e4c8300dd08aeb37f8e728b8dad
```

How does git calculate the hash? We can try calculating the sha1 sum directly, but how come that's not the hash we get?

``` bash
cat myfile.txt | shasum
# 22596363b3de40b06f981fb85d82312e8c0ed511  -
```

The actual blob file will need a bit of metadata - specifically the type of object (in this case 'blob') and the number of bytes of contents (in this case 12, including the trailing new line), finally with a null character.

[TODO DIAGRAM OF BLOB STRUCTURE]

```bash
echo -e "blob 12\0hello world" > myblob
cat myblob | shasum
# 3b18e512dba79e4c8300dd08aeb37f8e728b8dad  -
```

Now compress it into a zlib stream using, e.g. pigz, zlib-flate or openssl zlib

```bash
pigz --keep --zlib myblob
```

then chuck it into the database:

```bash
mkdir .git/objects/3b
mv myblob.zz .git/objects/3b/18e512dba79e4c8300dd08aeb37f8e728b8dad
```

Note that when when git garbage collection kicks into gear, it optimizes out these object files into "packs".

Now, if we print out all the git objects, we should see our new blob.

```bash
git cat-file --batch-check --batch-all-objects
# 3b18e512dba79e4c8300dd08aeb37f8e728b8dad blob 12

git cat-file -p 3b18e512dba79e4c8300dd08aeb37f8e728b8dad
# hello world
```

We can do all that using `git hash-object -w` as well:

```bash
echo foobar > otherfile.txt
git hash-object -t blob -w otherfile.txt
# 323fae03f4606ea9991df8befbb2fca795e648fa

find .git/objects -type f
```

Nice, so we can store the contents of individual files. What about filenames and directories? For that, we turn to trees.

## Trees

What is a directory, if not just a list of child filenames and child folder names and their associated ids?

Specifically, each list entry is `[file mode] [filename with null terminator] [sha1bytes]`. Note we have to turn our hash string into bytes first, which we can do using `xxd -r -p`.

[TODO DIAGRAM OF BLOB STRUCTURE]

```bash
echo -e -n "100644 copy.txt\0" > childtree
echo 3b18e512dba79e4c8300dd08aeb37f8e728b8dad | xxd -r -p >> childtree
git hash-object -t tree -w childtree
# 8209f53524b4818a6d18424613de08c1c6552f11

echo -e -n "40000 folder\0" > mytree
echo 8209f53524b4818a6d18424613de08c1c6552f11 | xxd -r -p >> mytree
echo -e -n "100644 myfile.txt\0" >> mytree
echo 3b18e512dba79e4c8300dd08aeb37f8e728b8dad | xxd -r -p >> mytree
echo -e -n "100644 otherfile.txt\0" >> mytree
echo 323fae03f4606ea9991df8befbb2fca795e648fa | xxd -r -p >> mytree
git hash-object -t tree -w mytree
# 6db497f8ca5a8bf50591fd13beb12fc66dff1d31
```

We can inspect it:

```bash
git ls-tree 6db497f8ca5a8bf50591fd13beb12fc66dff1d31
# 040000 tree 8209f53524b4818a6d18424613de08c1c6552f11    folder
# 100644 blob 3b18e512dba79e4c8300dd08aeb37f8e728b8dad    myfile.txt
# 100644 blob 323fae03f4606ea9991df8befbb2fca795e648fa    otherfile.txt

git ls-tree -r 6db497f8ca5a8bf50591fd13beb12fc66dff1d31
# 100644 blob 3b18e512dba79e4c8300dd08aeb37f8e728b8dad    folder/copy.txt
# 100644 blob 3b18e512dba79e4c8300dd08aeb37f8e728b8dad    myfile.txt
# 100644 blob 323fae03f4606ea9991df8befbb2fca795e648fa    otherfile.txt
```

There's similarly a `git mktree` command that makes this easier - taking in the format of `ls-tree` without having to add null bytes or convert the sha to bytes.

## Commits

If we can then create a tree that describes the snapshot of the entire codebase at a particular point in time, we can then use that to describe a commit. Just the tree isn't enough though - we'd like to attach some metadata to the tree, like who made this commit, when was it made, and a description of what this commit is about.

The contents of a commit object is actually very readable and easy to write as it's all just in ASCII this time.

[TODO DIAGRAM]

Let's create a commit using the root tree object we created last time (6db497f8ca5a8bf50591fd13beb12fc66dff1d31).

Since it's the first commit, there won't be any parent.

```bash
echo tree 6db497f8ca5a8bf50591fd13beb12fc66dff1d31 > mycommit.txt
echo "author Waylon Smithers <mr@smithers.invalid> 1762902000 +1300" >> mycommit.txt
echo "committer Charles Montgomery Plantagenet Schicklgruber Burns <mr@burns.invalid> 1762902000 +1300" >> mycommit.txt
echo "" >> mycommit.txt
echo "My first commit" >> mycommit.txt
git hash-object -t commit -w mycommit.txt
# 02cbc162b0a74f3cbb90c6c7bcf7387b3033015b

git show 02cbc162b0a74f3cbb90c6c7bcf7387b3033015b
```

There's a handy command to do that: `git commit-tree`.

Say we want to create a new commit where we modify `folder/copy.txt`

We will use `git mktree` this time too.

```bash
echo modified | git hash-object -w --stdin
# 2e0996000b7e9019eabcad29391bf0f5c7702f0b

echo -e "100644 blob 2e0996000b7e9019eabcad29391bf0f5c7702f0b\tcopy.txt" | git mktree
# 974cd135eb6c4da9d3f14e1de564f76a8a07234e

echo -e "040000 tree 974cd135eb6c4da9d3f14e1de564f76a8a07234e\tfolder
100644 blob 3b18e512dba79e4c8300dd08aeb37f8e728b8dad\tmyfile.txt
100644 blob 323fae03f4606ea9991df8befbb2fca795e648fa\totherfile.txt" | git mktree
# 486a17fba0168a9242e39931c2b0233ada6a9671

GIT_AUTHOR_DATE="2025-11-12T12:00:00+13" GIT_COMMITTER_DATE="2025-11-12T12:00:00+13" git commit-tree -p 02cbc162b0a74f3cbb90c6c7bcf7387b3033015b -m "Second commit!" 486a17fba0168a9242e39931c2b0233ada6a9671
# 704cad9af4578d8f3248fe4c4e044014322f1154

git log 704cad9af4578d8f3248fe4c4e044014322f1154

git show 704cad9af4578d8f3248fe4c4e044014322f1154
```

# Index, the Staging Area

Now, how should we design the frontend commands to commit their files? Although Mecurial and Git are very similar, they diverge here in their approach: Mercurial commits directly what's in the working directory, while Git has a staging area. https://stackoverflow.com/questions/54805005/why-does-git-need-to-design-index-stage, and it appears to be a feature that was already there since the beginning of git in its first commit. https://about.gitlab.com/blog/journey-through-gits-20-year-history/

The staging area is stored as the file `.git/index`. It is effectively a binary file that stores the relationship between filepaths and the corresponding blob object ids, plus some other metadata. The binary format is a bit tedious to write manually, so let's use `git update-index` to help us modify it instead.

https://git-scm.com/docs/index-format

```bash
git update-index --add --cacheinfo 100644,2e0996000b7e9019eabcad29391bf0f5c7702f0b,my/path/to/file.txt
```

which is similar to what happens when you run `git add` on a file.

After which, we can generate a new tree out of the index:

```bash
git write-tree
# TODO resulting tree id

git ls-tree -r TODOthattreeid
```

which is similar to what happens when you run `git commit` and it needs to generate the tree object for the commit.

There's also `git read-tree` to read a tree into index.

# Refs

As you may have noticed by now, having to keep track of all these object id hashes is quite a pain. Let's give them names that we can use to **ref**er back to the objects. Let's create some refs.

## Tags (lightweight unannotated tags)

How about we just chuck a file in `.git/refs/tags/*` vwith the name of the tag, and put the object id in the file contents.

```bash
echo 704cad9af4578d8f3248fe4c4e044014322f1154 > .git/refs/tags/mytag
```

Let's have a handy command to do this:

```bash
git update-ref refs/tags/mytag 704cad9
```

And now we can refer to that commit using our tag name:

```bash
git show mytag
```

But, as you imagine, it's still quite inconvenient. It's useful to know what's our latest and current commit that we are working on, and the idea of tags don't really fit in here if we want a way to refer to the latest commit that will change every time we make a new commit.

## Heads (aka branches)

Instead, let's create a new kind of ref, called a "head" - that represents what we are currently working on.

```bash
echo 704cad9af4578d8f3248fe4c4e044014322f1154 > .git/refs/heads/master

git show master
```

There can be multiple commits where we are interested in working on and we'd like to keep track of, so we can create additional heads for them too, and we can call each "line of work" as a "branch" for each of the heads we have:

```bash
echo 02cbc162b0a74f3cbb90c6c7bcf7387b3033015b > .git/refs/heads/story

git show story
```

Then we can plonk a ***symbolic ref*** called `.git/HEAD` in all capitals that point to which head we are currently working on.

```bash
echo ref:refs/heads/master > .git/HEAD
```

and now we can just do

```bash
git show
```

And we can design our commands so that this kind of ref is automatically updated whenever we create a new commit while we're on a branch.

```bash
cat .git/refs/heads/master
# 704cad9af4578d8f3248fe4c4e044014322f1154
echo new-content > newfile.txt
git add newfile.txt
git commit -m "Third commit"
cat .git/refs/heads/master
# Note the hash changed
```

We have some convenience commands to handle these refs: `git update-ref` and `git symbolic-ref`. These also write to the reflogs: `.git/logs/HEAD` and `.git/logs/refs/*` so we can look back at the history in case we ever need to, using `git reflog`.

# Merges

We've talked about objects, commits, and branches, let's talk about what happens when you have two branches and we want to merge one branch into another.

## 3 way merge

But how would we go about it? Say we have file we changed in two different ways and we now want to reconsolidate the two.

We could directly diff the two: Wherever they match, we're good. But what do we do when they don't match? We don't really have any information from just the diff to know what the intent is and whether the mismatch is coming from one side only or whether it's coming from both sides, so we need some more information.

More importantly, we want to compare both versions to a third version: the base, that both versions originate from, so we can tell which changes are introduced only from one side and we can safely merge in.

This is where the 3-way diff comes in. From way back in 1979 Unix Version 7, there was a program called diff3 which provided this algorithm, and it was used in some VCSs at the time long before git.

Git provides a plumbing command for merging a single file in a 3-way merge. You can give it a try:

```bash
echo "a

b

c" > base.txt
echo "a1

b1

c" > current.txt
echo "a

b2

c2" > other.txt

diff3 --merge current.txt base.txt other.txt
# a1
# 
# <<<<<<< current.txt
# b1
# ||||||| base.txt
# b
# =======
# b2
# >>>>>>> other.txt
# 
# c2

git merge-file --stdout current.txt base.txt other.txt
# a1
# 
# <<<<<<< current.txt
# b1
# =======
# b2
# >>>>>>> other.txt
# 
# c2
```

For merging the entire codebase tree rather than individual files, we have `git merge-tree`.

```bash
git checkout -b branch1
echo Content from branch 1 > branch1.txt
echo Conflict from branch 1 > conflict.txt
git add branch1.txt conflict.txt
git commit -m "Commit 1"

git checkout -

git checkout -b branch2
echo Content from branch 2 > branch2.txt
echo Conflict from branch 2 > conflict.txt
git add branch2.txt conflict.txt
git commit -m "Commit 2"

git checkout -

git merge-tree --write-tree --merge-base=master branch1 branch2
```

## Merge base

A good merge-base would be the commit from which we find unmerged changes between branch1 and branch2, and that turns out to be the common ancestor. We can find this using:

```bash
git merge-base --all branch1 branch2
```

## Recursive merge and criss-cross merges

But what happens when there are multiple candidates for the merge base? This might seem unintuitive but it can happen with e.g. criss-cross merges.

```bash
git checkout branch1
git merge branch2
git add conflict.txt
git commit -m "Merge branch 2 into 1"

git checkout branch2
git merge branch1
git add conflict.txt
git commit -m "Merge branch 1 into 2"

git merge-base --all branch1 branch2
```

How should we consolidate this? Well, we have two merge-bases but our 3-way merge only works with one merge-base: how about we just merge the two merge-bases together? And that's where the "recursive"ness of the "recursive" merge comes in. Git recursively merges the merge bases until we have one left. You can imagine that the merge-bases themselves can also have multiple merge-bases that needs consolidating, hence recursive.

## Ort algorithm

These days, instead of seeing the words "recursive algorithm" in the merge messages, you might come across the words "ORT algorithm" instead, which is a newer algorithm introduced in Git 2.33 in 2021 (Ostensibly Recursive’s Twin) and now the recursive algorithm option is a synonym of this ORT algorithm.

Fun fact - it's a pun! To specify the merge algorithm, we use the -s flag for strategy, and so the command line becomes `git merge -s ort` ... get it?

Anyhow, this new algorithm's main key points is it handles deletions and renames better.

# Sequencer: The infrastructure around Rebases and other utilities



## Cherry-pick

```bash
git merge-tree --merge-base=destination^ source destination
```

### Picking Merges - selecting parent

## Revert

```bash
git merge-tree --merge-base=destination source destination^
```

## Squashing

commit-tree

# Bad merges - Pitfalls to avoid

Before we know it, we've finally resurfaced back onto the coast of bad merges.

Now that we have cherry-picks and merging at our disposal, there are some footguns we need to be careful with where the resulting behaviour is unintuitive and usually undesirable.

Have you ever wondered why we have stricter rules around merging strategy between our long-lived branches? Have you wondered why there can be a bit of commotion when a mistake merge gets pushed upstream and we need to tell everyone to stop?

On one hand, it's a matter of keeping the history tidy and prevent information lost, but on a more technical note, it's about giving git the right knowledge about our intentions so it knows how to merge between branches correctly going forward.

https://devblogs.microsoft.com/oldnewthing/20180312-00/?p=98215
