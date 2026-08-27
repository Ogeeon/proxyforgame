#!/bin/bash
#
# Move the standby host from the Bitbucket deploy checkout to a clone of the
# GitHub repository.
#
#   ssh root@89.124.110.192 'bash -s' < cutover-standby.sh
#   ssh root@89.124.110.192 'bash -s' -- --dry-run < cutover-standby.sh
#
# Two things differ from production. This host has no document-root symlink -
# DocumentRoot is a literal path in two vhost files - so the script introduces
# the same indirection production already has, and afterwards both hosts roll
# back the same way: one ln -sfn, no Apache reload. And this host has no public
# hostname or certificate, so it is not a webhook target; it follows main on a
# five-minute timer instead.
#
set -euo pipefail

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

OLD=/var/www/proxyforgame-deploy
NEW=/var/www/proxyforgame-gh
LINK=/var/www/proxyforgame-docroot
REPO=https://github.com/Ogeeon/proxyforgame.git
VHOSTS="/etc/apache2/sites-available/proxyforgame.com.conf /etc/apache2/sites-available/proxyforgame.com-le-ssl.conf"
STAMP=$(date +%Y%m%d-%H%M%S)
PORT=8123

say() { printf '\n=== %s ===\n' "$*"; }
die() { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }

# --- 1. Preconditions ------------------------------------------------------
say "1. Preconditions"
[ "$(id -u)" = 0 ] || die "must run as root"
[ -d "$OLD/htdocs" ] || die "$OLD/htdocs missing"
[ -f "$OLD/.env" ] || die "no .env in $OLD"
[ -e "$NEW" ] && die "$NEW already exists - remove it or finish the previous attempt"
for v in $VHOSTS; do
  [ -f "$v" ] || die "$v missing"
  grep -q "DocumentRoot $OLD/htdocs" "$v" || die "$v does not point at $OLD/htdocs"
  grep -q "<Directory $OLD/htdocs>" "$v" || die "$v has no <Directory $OLD/htdocs> block"
done
echo "OK - old checkout, .env and both vhosts are as expected"

# --- 2. Clone --------------------------------------------------------------
say "2. Cloning $REPO"
git clone --quiet "$REPO" "$NEW"
chown -R www-data:www-data "$NEW"
# The checkout belongs to www-data, so root's git refuses to read it until the
# path is declared safe - the same entry the old checkout already carries.
git config --global --get-all safe.directory | grep -qx "$NEW" || git config --global --add safe.directory "$NEW"
HEAD_LINE=$(git -C "$NEW" log --oneline -1) || die "cannot read the clone's HEAD"
echo "HEAD: $HEAD_LINE"
install -o www-data -g www-data -m 640 "$OLD/.env" "$NEW/.env"
echo "Copied .env"

# --- 3. Compare ------------------------------------------------------------
say "3. Comparing new www/ against live htdocs/"
git -C "$NEW" ls-tree -r HEAD | awk '$4 ~ /^www\//    {print substr($4,5), $3}' | LC_ALL=C sort > /tmp/new-$STAMP.txt
git -C "$OLD" ls-tree -r HEAD | awk '$4 ~ /^htdocs\// {print substr($4,8), $3}' | LC_ALL=C sort > /tmp/old-$STAMP.txt
echo "$(LC_ALL=C comm -12 /tmp/new-$STAMP.txt /tmp/old-$STAMP.txt | wc -l) of $(wc -l < /tmp/old-$STAMP.txt) live files are byte-identical in the clone"
DIFFERING=$(LC_ALL=C comm -3 /tmp/new-$STAMP.txt /tmp/old-$STAMP.txt | awk '{print $1}' | sort -u)
if [ -n "$DIFFERING" ]; then
  echo "Differing, or present on only one side:"
  # shellcheck disable=SC2086
  printf '  %s\n' $DIFFERING
fi

# --- 4. Smoke-test the new tree before it serves anyone --------------------
say "4. Smoke test on 127.0.0.1:$PORT (nothing live is touched yet)"
runuser -u www-data -- php -S "127.0.0.1:$PORT" -t "$NEW/www" >/tmp/smoke-$STAMP.log 2>&1 &
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
[ "$FAILED" = 0 ] || die "the new tree does not serve correctly - nothing changed"

if [ "$DRY_RUN" = 1 ]; then
  say "Dry run complete"
  echo "Nothing live was touched. The clone is left at $NEW - delete it before a real run."
  exit 0
fi

# --- 5. Symlink + Apache ---------------------------------------------------
say "5. Introducing the document-root symlink"
ln -sfn "$NEW/www" "$LINK"
for v in $VHOSTS; do
  cp -p "$v" "$v.bak-$STAMP"
  # The <Directory> block has to move with it. Apache matches that block against
  # the path as configured, symlink and all, so a block still naming the old
  # literal path grants AllowOverride to nobody: .htaccess is ignored and every
  # language prefix answers 404 while / and *.php still look healthy.
  sed -i "s#DocumentRoot $OLD/htdocs#DocumentRoot $LINK#; s#<Directory $OLD/htdocs>#<Directory $LINK>#" "$v"
done
echo "Vhost backups: *.bak-$STAMP"
if ! apache2ctl configtest; then
  for v in $VHOSTS; do mv "$v.bak-$STAMP" "$v"; done
  die "configtest failed - vhosts restored, nothing else changed"
fi
systemctl reload apache2
sleep 3
FAILED=0
# The host is not in DNS, so ask it by loopback while claiming the vhost name.
# It must be https: port 80 here carries certbot's permanent redirect, so a
# plain http request answers 301 and never reaches the site at all.
for path in "/" "/ru/" "/ogame/calc/flight.php"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    --resolve "proxyforgame.com:443:127.0.0.1" "https://proxyforgame.com$path" || echo 000)
  if [ "$code" = 200 ]; then
    echo "  OK   $code  $path"
  else
    echo "  FAIL $code  $path"; FAILED=1
  fi
done
if [ "$FAILED" != 0 ]; then
  echo
  echo "Live check failed - rolling back."
  ln -sfn "$OLD/htdocs" "$LINK"
  for v in $VHOSTS; do cp -p "$v.bak-$STAMP" "$v"; done
  apache2ctl configtest && systemctl reload apache2
  die "vhosts and document root are back on the Bitbucket checkout"
fi
echo "DocumentRoot is now $LINK -> $(readlink "$LINK")"
echo "From here on, switching versions is a single ln -sfn against that link."

# --- 6. Cron ---------------------------------------------------------------
say "6. Repointing cron at the new checkout"
crontab -l -u www-data > "/root/crontab-www-data.bak-$STAMP"
echo "Backup: /root/crontab-www-data.bak-$STAMP"
crontab -l -u www-data | sed "s#$OLD#$NEW#g" | crontab -u www-data -

# --- 7. Install the sync tooling and the timer -----------------------------
say "7. Installing pfg-sync and the five-minute timer"
install -m 755 "$NEW/deploy/pfg-sync" "$NEW/deploy/pfg-notify" /usr/local/bin/
{
  echo "CHECKOUT=$NEW"
  echo "SMOKE_BASE=https://proxyforgame.com"
  echo "SMOKE_RESOLVE=proxyforgame.com:443:127.0.0.1"
  echo "LOG=/var/log/pfg-cron.log"
  echo "LOCK=/run/lock/pfg-sync.lock"
  echo "MAIL_TO=proxyforgame@gmail.com"
  echo "PHP=/usr/bin/php"
} > /etc/pfg-sync.conf
chmod 644 /etc/pfg-sync.conf
echo "Config: /etc/pfg-sync.conf"

# Five minutes, not a webhook: this host has no public name and no certificate,
# so pointing GitHub at it would mean the secret and the payload travelling in
# clear. A timer needs no inbound path at all, and being a cold copy the host
# has no use for the difference between one minute and five.
( crontab -l -u www-data; echo "*/5 * * * * /usr/local/bin/pfg-sync >> /var/log/pfg-cron.log 2>&1" ) | crontab -u www-data -
crontab -l -u www-data | sed 's/^/  /'
runuser -u www-data -- /usr/local/bin/pfg-sync --check || true

say "Done"
echo "Standby serves $NEW/www and follows GitHub main every five minutes."
echo "Old checkout untouched at $OLD."
echo
echo "Rollback:"
echo "  ln -sfn $OLD/htdocs $LINK"
echo "  crontab -u www-data /root/crontab-www-data.bak-$STAMP"
