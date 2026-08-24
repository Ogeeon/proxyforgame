#!/bin/bash
#
# Move production from the Bitbucket deploy checkout to a clone of the GitHub
# repository, by flipping the document-root symlink.
#
#   plink -ssh -batch -pw "$PW" www-proxyforgame@88.218.248.47 'bash -s' < cutover-prod.sh
#   plink ... 'bash -s' -- --dry-run < cutover-prod.sh     # phases 1-5 only
#
# Phases 1-5 touch nothing that serves traffic: they check, archive, clone,
# compare and smoke-test the new tree on a private port. --dry-run stops there.
# Only phase 6 flips the symlink, and it flips back by itself if the live site
# does not answer afterwards. The old checkout is never modified, so
# rollback-prod.sh keeps working for as long as it is still on disk.
#
set -euo pipefail

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

DATA=/var/www/www-proxyforgame/data
OLD=$DATA/deploy/proxyforgame.com
NEW=$DATA/deploy/proxyforgame.com-gh
LINK=$DATA/www/proxyforgame.com
BIN=$DATA/bin
REPO=https://github.com/Ogeeon/proxyforgame.git
PHP=/opt/php82/bin/php
STAMP=$(date +%Y%m%d-%H%M%S)
PORT=8123

say() { printf '\n=== %s ===\n' "$*"; }
die() { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }

# --- 1. Preconditions ------------------------------------------------------
say "1. Preconditions"
[ "$(whoami)" = "www-proxyforgame" ] || die "must run as www-proxyforgame, not $(whoami)"
[ -L "$LINK" ] || die "$LINK is not a symlink - the layout is not what this script assumes"
[ "$(readlink "$LINK")" = "$OLD/htdocs" ] || die "$LINK points at $(readlink "$LINK"), expected $OLD/htdocs"
[ -f "$OLD/.env" ] || die "no .env in $OLD"
[ -x "$PHP" ] || die "$PHP not found"
command -v git >/dev/null || die "git not found"
echo "OK - symlink, old checkout, .env, php and git are all where they should be"

# --- 2. Archive the files that exist only here -----------------------------
say "2. Archiving server-only files"
cd "$OLD"
ORPHANS=$(git status --porcelain | awk '/^\?\?/ {print $2}')
if [ -n "$ORPHANS" ]; then
  # shellcheck disable=SC2086
  tar czf "$DATA/orphan-files-$STAMP.tar.gz" $ORPHANS test-rewrites.php 2>/dev/null || true
  echo "Archived to $DATA/orphan-files-$STAMP.tar.gz:"
  # shellcheck disable=SC2086
  printf '  %s\n' $ORPHANS test-rewrites.php
else
  echo "No untracked files - nothing to archive"
fi

# --- 3. Clone --------------------------------------------------------------
say "3. Cloning $REPO"
[ -e "$NEW" ] && die "$NEW already exists - remove it or finish the previous attempt"
git clone --quiet "$REPO" "$NEW"
echo "HEAD: $(git -C "$NEW" log --oneline -1)"
cp -p "$OLD/.env" "$NEW/.env"
chmod 640 "$NEW/.env"
echo "Copied .env ($(stat -c '%a %U:%G' "$NEW/.env"))"

# --- 4. Compare the new tree with what is live -----------------------------
# Blob ids are content hashes, so they compare across two unrelated histories.
say "4. Comparing new www/ against live htdocs/"
git -C "$NEW" ls-tree -r HEAD | awk '$4 ~ /^www\//    {print $3, substr($4,5)}' | sort -k2 > /tmp/new-$STAMP.txt
git -C "$OLD" ls-tree -r HEAD | awk '$4 ~ /^htdocs\// {print $3, substr($4,8)}' | sort -k2 > /tmp/old-$STAMP.txt
echo "$(comm -12 /tmp/new-$STAMP.txt /tmp/old-$STAMP.txt | wc -l) of $(wc -l < /tmp/old-$STAMP.txt) live files are byte-identical in the clone"
DIFFERING=$(comm -3 /tmp/new-$STAMP.txt /tmp/old-$STAMP.txt | awk '{print $2}' | sort -u)
if [ -n "$DIFFERING" ]; then
  echo "Differing, or present on only one side:"
  # shellcheck disable=SC2086
  printf '  %s\n' $DIFFERING
  echo "Anything beyond the known deltas means main and production really have"
  echo "diverged - stop and reconcile before letting this run past phase 5."
fi

# --- 5. Smoke-test the new tree before it serves anyone --------------------
say "5. Smoke test on 127.0.0.1:$PORT (nothing live is touched yet)"
"$PHP" -S "127.0.0.1:$PORT" -t "$NEW/www" >/tmp/smoke-$STAMP.log 2>&1 &
SMOKE_PID=$!
trap 'kill $SMOKE_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 20); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
FAILED=0
for path in "/" "/index.php?lang=ru" "/ogame/calc/flight.php" "/ogame/calc/costs.php" "/ogame/calc/trade.php"; do
  body=$(mktemp)
  code=$(curl -s -o "$body" -w '%{http_code}' "http://127.0.0.1:$PORT$path" || echo 000)
  size=$(wc -c < "$body"); rm -f "$body"
  if [ "$code" = 200 ] && [ "$size" -gt 1000 ]; then
    echo "  OK   $code ${size}b  $path"
  else
    echo "  FAIL $code ${size}b  $path"; FAILED=1
  fi
done
# One database-backed read: only this can show that .env survived the copy and
# that MySQL is answering. A static page would look healthy either way.
body=$(mktemp)
code=$(curl -s -o "$body" -w '%{http_code}' \
  "http://127.0.0.1:$PORT/ajax.php?service=populatedSystems&country=ru&universe=268" || echo 000)
if grep -q '"populatedSystems"' "$body"; then
  echo "  OK   $code  ajax populatedSystems"
else
  echo "  FAIL $code  ajax populatedSystems"; head -c 200 "$body"; echo; FAILED=1
fi
rm -f "$body"
kill $SMOKE_PID 2>/dev/null || true
trap - EXIT
[ "$FAILED" = 0 ] || die "the new tree does not serve correctly - production untouched"

if [ "$DRY_RUN" = 1 ]; then
  say "Dry run complete"
  echo "Everything above passed and nothing live was touched."
  echo "The clone is left at $NEW. Delete it before a real run, or the"
  echo "already-exists guard in phase 3 will stop that run."
  exit 0
fi

# --- 6. Flip ---------------------------------------------------------------
say "6. Flipping the document root"
ln -sfn "$NEW/www" "$LINK"
echo "$LINK -> $(readlink "$LINK")"
sleep 3   # opcache revalidates on a 2s timestamp check
FAILED=0
# /ru/ is in this list deliberately: it is the one URL that proves .htaccess is
# still in force now that the resolved document-root path changed under Apache.
for url in "https://proxyforgame.com/" "https://proxyforgame.com/ru/" "https://proxyforgame.com/ogame/calc/flight.php"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url" || echo 000)
  if [ "$code" = 200 ]; then
    echo "  OK   $code  $url"
  else
    echo "  FAIL $code  $url"; FAILED=1
  fi
done
if [ "$FAILED" != 0 ]; then
  echo
  echo "Live check failed - rolling back automatically."
  ln -sfn "$OLD/htdocs" "$LINK"
  die "rolled back to the Bitbucket checkout; the site should be as it was"
fi

# --- 7. Cron ---------------------------------------------------------------
say "7. Repointing cron at the new checkout"
crontab -l > "$DATA/crontab.bak-$STAMP"
echo "Backup: $DATA/crontab.bak-$STAMP"
crontab -l | sed "s#$OLD#$NEW#g" | crontab -

# --- 8. Install the sync tooling outside the checkout ----------------------
# Outside on purpose: pfg-sync resets the very tree it would otherwise be
# running from, and bash reads a script as it executes it.
say "8. Installing pfg-sync"
mkdir -p "$BIN" "$DATA/logs"
install -m 755 "$NEW/deploy/pfg-sync" "$NEW/deploy/pfg-notify" "$BIN/"
{
  echo "CHECKOUT=$NEW"
  echo "SMOKE_BASE=https://proxyforgame.com"
  echo "LOG=$DATA/logs/deploy.log"
  echo "LOCK=$DATA/pfg-sync.lock"
  echo "MAIL_TO=proxyforgame@gmail.com"
  echo "PHP=$PHP"
} > "$DATA/.pfg-sync.conf"
chmod 600 "$DATA/.pfg-sync.conf"
echo "Config: $DATA/.pfg-sync.conf"
"$BIN/pfg-sync" --check && echo "  checkout agrees with the newest green CI run" \
                        || echo "  (drift reported above - expected if main moved during the cutover)"

# The webhook is the fast path; this is the net under it. GitHub delivers a
# webhook at most once, so one lost delivery would otherwise strand production
# on an old commit behind a green CI and a healthy-looking site. The run is
# idempotent - with the webhook working it finds nothing to do and says nothing.
( crontab -l; echo "17 * * * * $BIN/pfg-sync >> $DATA/logs/deploy.log 2>&1" ) | crontab -
echo "Hourly reconcile installed:"
crontab -l | sed 's/^/  /'

say "Done"
echo "Production serves $NEW/www. The old checkout is untouched at $OLD."
echo "Roll back with rollback-prod.sh - one symlink flip plus the crontab backup."
echo
echo "Still manual, by design:"
echo "  1. write $DATA/pfg-webhook.conf with"
echo "       SECRET=<generate one>"
echo "       SYNC=$BIN/pfg-sync"
echo "       LOG=$DATA/logs/deploy.log"
echo "  2. install $NEW/deploy/webhook.php into $DATA/www/webhooks.proxyforgame.com/"
echo "     and delete the old bitbucket.php next to it"
echo "  3. add the GitHub webhook at webhooks.proxyforgame.com/webhook.php"
echo "     with the plain-http scheme, not https - that subdomain has no"
echo "     certificate of its own; deploy/README.md says why that is safe here"
echo "     events: workflow_run and workflow_dispatch, same secret"
echo "  4. confirm the Bitbucket webhook is already disabled"
