
#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

exec 4>>/dev/ttyS1
flock 4
cat <&0 >&4
