#!/bin/bash
# Runs a command on one of the two deploy hosts (deploy/README.md, "Host layout"):
#
#   bash scripts/pfg-ssh.sh prod    '<command>'
#   bash scripts/pfg-ssh.sh standby '<command>'
#
# Production is a managed ISPmanager account with password auth only, so it goes
# through plink (OpenSSH cannot take a password without a TTY). The password is read
# from PFG_PROD_PWFILE, default D:\tmp\claude\_pfg-prod.txt - a file the user drops
# outside the repo, so the password never lands in a transcript or in git. The
# standby takes the ed25519 key. Either host's firewall only lets SSH in from the
# user's own address; a timeout means the wrong network, not a dead host.
set -euo pipefail

host=${1:-}
[ $# -ge 2 ] || { echo "Usage: bash scripts/pfg-ssh.sh prod|standby '<command>'" >&2; exit 2; }
shift

case "$host" in
    prod)
        pwfile=${PFG_PROD_PWFILE:-/d/tmp/claude/_pfg-prod.txt}
        [ -s "$pwfile" ] || { echo "No production password at $pwfile - ask the user to put it there." >&2; exit 1; }
        # Strip NULs and a UTF-8/UTF-16 BOM: Windows editors like to save the file as
        # UTF-16, and plink then gets a mangled password and says "Access denied".
        pw=$(tr -d '\000\r\n' < "$pwfile" | sed $'s/^\xEF\xBB\xBF//; s/^\xFF\xFE//')
        exec plink -batch -ssh -pw "$pw" www-proxyforgame@88.218.248.47 "$@"
        ;;
    standby)
        exec ssh -o BatchMode=yes -o ConnectTimeout=15 -i ~/.ssh/id_ed25519 root@89.124.110.192 "$@"
        ;;
    *)
        echo "Unknown host '$host' - use prod or standby." >&2
        exit 2
        ;;
esac
