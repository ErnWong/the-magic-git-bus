
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

As you imagine, a project has many things, so we will have many objects. Let's have a folder to store them.

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

But how come that's not the hash we get?

``` bash
cat myfile.txt | shasum
# 22596363b3de40b06f981fb85d82312e8c0ed511  -
```

The actual blob file will need a bit of metadata - specifically the type of object (in this case 'blob') and the number of bytes of contents (in this case 12, including the trailing new line), finally with a null character.

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

What is a directory, if not just a list of child filenames and child folder names and their associated ids?

Specifically, each list entry is `[file mode] [filename with null terminator] [sha1bytes]`. Note we have to turn our hash string into bytes first, which we can do using `xxd -r -p`.

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
