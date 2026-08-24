#!/bin/bash
#
# Undo cutover-prod.sh: point the document root back at the Bitbucket checkout
# and restore the crontab from the newest backup.
#
#   plink -ssh -batch -pw "$PW" www-proxyforgame@88.218.248.47 'bash -s' < rollback-prod.sh
#
# This is the cutover escape hatch, not the everyday one. To put an older commit
# back on a site that is already running the GitHub checkout, dispatch the Deploy
# workflow with that commit, or run: pfg-sync --sha <sha>
#
set -euo pipefail

DATA=/var/www/www-proxyforgame/data
OLD=$DATA/deploy/proxyforgame.com
LINK=$DATA/www/proxyforgame.com

[ "$(whoami)" = "www-proxyforgame" ] || { echo "must run as www-proxyforgame" >&2; exit 1; }
[ -d "$OLD/htdocs" ] || { echo "$OLD/htdocs is gone - this rollback path no longer exists" >&2; exit 1; }

echo "Before: $LINK -> $(readlink "$LINK")"
ln -sfn "$OLD/htdocs" "$LINK"
echo "After:  $LINK -> $(readlink "$LINK")"

BAK=$(ls -1t "$DATA"/crontab.bak-* 2>/dev/null | head -1 || true)
if [ -n "$BAK" ]; then
  crontab "$BAK"
  echo "Crontab restored from $BAK"
else
  echo "No crontab backup found - check 'crontab -l' by hand" >&2
fi

sleep 3   # opcache revalidates on a 2s timestamp check
for url in "https://proxyforgame.com/" "https://proxyforgame.com/ru/" "https://proxyforgame.com/ogame/calc/flight.php"; do
  printf '  %s  %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$url" || echo 000)" "$url"
done

echo
echo "The GitHub clone is left in place. Disable the GitHub webhook before"
echo "walking away, or the next green CI run will simply undo this."
