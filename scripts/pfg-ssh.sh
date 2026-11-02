#!/bin/bash
# Runs a command on the deploy host (deploy/README.md, "The host"):
#
#   bash scripts/pfg-ssh.sh '<command>'
#   bash scripts/pfg-ssh.sh 'bash -s' < local-script.sh
#
# The one host that serves both domains (docs/adr/0003-single-host-php-8-5.md).
# It logs in as root with the ed25519 key from ~/.ssh; BatchMode makes a missing
# key fail at once instead of prompting, and ConnectTimeout bounds a hung connect.
set -euo pipefail

[[ $# -ge 1 ]] || { echo "Usage: bash scripts/pfg-ssh.sh '<command>'" >&2; exit 2; }

exec ssh -o BatchMode=yes -o ConnectTimeout=15 -i ~/.ssh/id_ed25519 root@89.124.110.192 "$@"
