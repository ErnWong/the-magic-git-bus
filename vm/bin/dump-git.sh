#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

{
    for oid in $(git cat-file --batch-all-objects --batch-command="%(objectname)")
    do
        type="$(git cat-file -t $oid)"
        if [[ "$type" == "commit" ]]
        then
            git --no-pager log -1 --pretty='format:%H%x00%P%x00%T%x00%s' $oid |
                jq --compact-output --raw-input '
                    rtrimstr("\n") 
                    | split("\u0000")
                    | {
                        type: "commit",
                        id: .[0],
                        parents: .[1] | split(" "),
                        tree: .[2],
                        subject: .[3]
                    }'
        elif [[ "$type" == "tree" ]]
        then
            {
                echo $oid
                git ls-tree --format='%(path)%x00%(objectname)' $oid
            } | jq --compact-output --raw-input --slurp '
                rtrimstr("\n") 
                | split("\n")
                | {
                    type: "tree",
                    id: .[0],
                    entries: .[1:] | map(split("\u0000") | { name: .[0], id: .[1] })
                }'
        elif [[ "$type" == "blob" ]]
        then
            {
                echo -n -e "$oid\x00"
                git cat-file blob $oid
            } | jq --compact-output --raw-input --slurp '
                rtrimstr("\n") 
                | split("\u0000")
                | {
                    type: "blob",
                    id: .[0],
                    content: .[1]
                }'
        elif [[ "$type" == "tag" ]]
        then
            {
                echo -n -e "$oid\x00"
                git cat-file tag $oid
            } | jq --compact-output --raw-input --slurp '
                rtrimstr("\n") 
                | split("\u0000")
                | {
                    type: "tag",
                    id: .[0],
                    info: .[1] | split("\n") | {
                        target: .[0] | ltrimstr("object "),
                        tag: .[2] | ltrimstr("tag "),
                        message: .[5:] | join("\n")
                    }
                } | {
                    type: .type,
                    id: .id,
                    target: .info.target,
                    tag: .info.tag,
                    message: .info.message
                }'
        fi
    done

    git for-each-ref --format="%(refname)%00%(objectname)%00%(symref)" |
        jq --compact-output --raw-input '
            rtrimstr("\n") 
            | split("\u0000")
            | {
                refname: .[0],
                target: .[1],
                symref: .[2]
            }'
} | jq --compact-output --slurp
