#!/bin/bash
#
# Checks both hosts from outside and fails if either is not serving, has fallen
# behind the newest green commit, or has a cron job that stopped running.
#
#   deploy/watchdog.sh              check both hosts
#   deploy/watchdog.sh production   check one of them
#
# Run on a schedule by .github/workflows/watchdog.yml, and by hand from
# anywhere with curl, node and gh. Everything it looks at is public: the site
# itself and `ajax.php?service=health`, which reports the deployed commit and
# the last run of each cron job. Nothing here needs a key to either host,
# which is the point - a watchdog holding root on the machine it watches is a
# worse problem than the one it solves.
#
# What it deliberately does not do is judge the standby's certificate. That one
# cannot renew itself (its name resolves to production, so the HTTP-01
# challenge lands there) and the decision on record is to reissue it by hand
# during a failover. So the standby is asked over TLS without verification and
# its expiry is reported, not enforced; a warning is printed while it still has
# time to matter.
#
set -uo pipefail

# Both addresses are already public in deploy/README.md; the standby has no
# name of its own, so it is asked by IP while claiming the vhost's name.
PROD_BASE="https://proxyforgame.com"
STANDBY_IP="89.124.110.192"
SITE_HOST="proxyforgame.com"   # the name both hosts answer to

REPO="${GITHUB_REPOSITORY:-Ogeeon/proxyforgame}"
CI_WORKFLOW="playwright.yml"   # file name, not display name - the workflow is called "CI"

# A daily job is late once a day and a bit has passed; the slack absorbs a slow
# run and a host whose clock drifts.
MAX_AGE=93600
# The standby polls every five minutes and production deploys on a webhook, so
# a target that only just went green is not yet anybody's fault.
DEPLOY_GRACE=900
CERT_WARN_DAYS=14

# The pinned PHP major.minor - production's, and the one CI installs. Production
# must serve exactly this; the standby only must not be older than it, since it
# is on whatever its OS ships (ADR-0001). Empty if the file cannot be read, and
# the check then only warns.
PINNED_PHP=$(tr -d ' \t\r\n' < "$(dirname "$0")/../.php-version" 2>/dev/null || true)

FAILED=0
fail() { printf '  FAIL %s\n' "$*"; FAILED=1; }
ok()   { printf '  ok   %s\n' "$*"; }
warn() { printf '  warn %s\n' "$*"; }

for tool in curl node sha256sum; do
  command -v "$tool" >/dev/null || { echo "watchdog: $tool is required" >&2; exit 2; }
done

# JSON is read with node rather than jq: node is already a hard dependency of
# this repository, jq is not installed on every machine someone might run this
# from, and the runner has both. Each helper prints plain lines for the shell
# and exits non-zero when the document is not what it should be.
read_health() {
  node -e '
    const fs = require("fs");
    let d;
    try { d = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch (e) { process.exit(1); }
    console.log("commit " + (d.commit || ""));
    console.log("php " + (d.php || ""));
    console.log("webhook " + (d.webhook || ""));
    for (const [name, job] of Object.entries(d.jobs || {})) {
      console.log("job " + name + " " + job.ageSeconds + " " + job.status);
    }
  ' "$1"
}

# The newest successful push-run in a runs document - by updated_at, not by the
# order GitHub happens to return, which for this endpoint is not guaranteed and
# has served a six-month-old run as "newest" before now.
read_newest_green() {
  node -e '
    const fs = require("fs");
    let d;
    try { d = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch (e) { process.exit(1); }
    const runs = (d.workflow_runs || [])
      .filter(r => r.conclusion === "success")
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    if (!runs.length) process.exit(1);
    console.log(runs[0].head_sha + " " + runs[0].updated_at);
  ' "$1"
}

# The commit ids of main, newest first, one per line.
read_commit_list() {
  node -e '
    const fs = require("fs");
    let d;
    try { d = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch (e) { process.exit(1); }
    for (const c of (Array.isArray(d) ? d : [])) console.log(c.sha);
  ' "$1"
}

# Prints "<sha> <updated_at>" if a push run of CI concluded successfully for
# exactly $1, nothing otherwise. head_sha is an exact filter - no ordering to
# trip over.
green_run_for() {
  local sha="$1" json
  json=$(mktemp)
  gh api "repos/$REPO/actions/workflows/$CI_WORKFLOW/runs?head_sha=$sha&event=push&status=success&per_page=1" \
    > "$json" 2>/dev/null || { rm -f "$json"; return 1; }
  read_newest_green "$json" || { rm -f "$json"; return 1; }
  rm -f "$json"
}

# True when major.minor version $1 is strictly older than $2. Both come from
# PHP_MAJOR_VERSION / PHP_MINOR_VERSION, so each half is a plain integer.
php_older_than() {
  local a_major=${1%%.*} a_minor=${1#*.} b_major=${2%%.*} b_minor=${2#*.}
  if [ "$a_major" -ne "$b_major" ]; then
    [ "$a_major" -lt "$b_major" ]
  else
    [ "$a_minor" -lt "$b_minor" ]
  fi
}

# ---------------------------------------------------------------------------
# What both hosts should be running: the newest commit of main whose CI passed.
# Comparing against the tip of main instead would cry every time a push is
# still building, and every time main is red.
#
# Resolved the same way pfg-sync resolves its deploy target: the tip of main if
# its CI has gone green, else the newest ancestor that has, walking the commit
# list and never further than MAX_WALK. Asking the runs endpoint for "the
# newest successful run" directly is what a stale answer once turned into a
# false alarm.
# ---------------------------------------------------------------------------
MAX_WALK=20
TARGET=""
TARGET_AGE=""
if command -v gh >/dev/null; then
  LIST_JSON=$(mktemp)
  gh api "repos/$REPO/commits?sha=main&per_page=$MAX_WALK" > "$LIST_JSON" 2>/dev/null || true
  NEWEST=""
  while read -r sha; do
    [ -n "$sha" ] || continue
    NEWEST=$(green_run_for "$sha" || true)
    [ -n "$NEWEST" ] && break
  done <<< "$(read_commit_list "$LIST_JSON" || true)"
  rm -f "$LIST_JSON"
  if [ -n "$NEWEST" ]; then
    TARGET=${NEWEST%% *}
    TARGET_AGE=$(( $(date -u +%s) - $(date -u -d "${NEWEST#* }" +%s) ))
  fi
fi
if [ -n "$TARGET" ]; then
  echo "Target commit: ${TARGET:0:7} (green ${TARGET_AGE:-?}s ago)"
else
  echo "Target commit: unknown - the deployed commit will be reported, not checked"
fi

# ---------------------------------------------------------------------------
# One host.
#   check_host <label> <base-url> [curl args...]
# ---------------------------------------------------------------------------
check_host() {
  local label="$1" base="$2"; shift 2
  local curl_args=("$@")

  printf '\n%s (%s)\n' "$label" "$base"

  local body code size
  for path in "/" "/ru/"; do
    body=$(mktemp)
    code=$(curl -s --max-time 20 "${curl_args[@]}" -o "$body" -w '%{http_code}' "$base$path" || true)
    code=${code:-000}
    size=$(wc -c < "$body"); rm -f "$body"
    if [ "$code" = 200 ] && [ "$size" -gt 1000 ]; then
      ok "$path ($code, ${size}b)"
    else
      fail "$path answered $code, ${size}b"
    fi
  done

  # The one call that proves .env survived the deploy and MySQL is answering.
  body=$(mktemp)
  code=$(curl -s --max-time 20 "${curl_args[@]}" -o "$body" -w '%{http_code}' \
    "$base/ajax.php?service=populatedSystems&country=ru&universe=268" || true)
  code=${code:-000}
  if grep -q '"populatedSystems"' "$body"; then
    ok "ajax populatedSystems ($code)"
  else
    fail "ajax populatedSystems answered $code without the expected body"
  fi
  rm -f "$body"

  # ---- the health report ----
  body=$(mktemp)
  code=$(curl -s --max-time 20 "${curl_args[@]}" -o "$body" -w '%{http_code}' \
    "$base/ajax.php?service=health" || true)
  code=${code:-000}
  local health
  health=$(read_health "$body")
  rm -f "$body"
  if [ "$code" != 200 ] || [ -z "$health" ]; then
    fail "ajax health answered $code and no usable JSON"
    return
  fi

  local deployed
  deployed=$(echo "$health" | sed -n 's/^commit //p')
  if [ -z "$deployed" ]; then
    fail "health reports no deployed commit - is .git readable?"
  elif [ -z "$TARGET" ]; then
    warn "deployed ${deployed:0:7}, nothing to compare it against"
  elif [ "$deployed" = "$TARGET" ]; then
    ok "deployed ${deployed:0:7}"
  elif [ -n "$TARGET_AGE" ] && [ "$TARGET_AGE" -lt "$DEPLOY_GRACE" ]; then
    warn "deployed ${deployed:0:7}, target ${TARGET:0:7} went green ${TARGET_AGE}s ago - still within grace"
  else
    fail "deployed ${deployed:0:7} but the newest green commit is ${TARGET:0:7}"
  fi

  # ---- the PHP version ----
  # Production is held to .php-version exactly - it is the pin, and CI installs
  # the same. The standby runs its OS's PHP and is allowed to be ahead, but
  # never behind: an older spare is the one that breaks on failover.
  local php_ver
  php_ver=$(echo "$health" | sed -n 's/^php //p')
  if [ -z "$PINNED_PHP" ]; then
    warn "no .php-version to check the PHP against (reported ${php_ver:-none})"
  elif [ -z "$php_ver" ]; then
    fail "health reports no PHP version"
  elif [ "$php_ver" = "$PINNED_PHP" ]; then
    ok "PHP $php_ver"
  elif [ "$label" = production ]; then
    fail "PHP $php_ver, but .php-version pins $PINNED_PHP - CI and production move together"
  elif php_older_than "$php_ver" "$PINNED_PHP"; then
    fail "PHP $php_ver is older than the pinned $PINNED_PHP"
  else
    warn "PHP $php_ver is ahead of the pinned $PINNED_PHP - expected, it tracks its OS"
  fi

  # ---- the GitHub receiver ----
  # webhook.php is served from the webhooks vhost's document root, outside the
  # checkout, so a deploy updates deploy/webhook.php and leaves the running copy
  # untouched. Nothing warned when a change to the receiver was never installed.
  # Health publishes the digest of what is actually running; compare it against
  # the repository's copy AT THE COMMIT THAT HOST SAYS IS DEPLOYED, not at the
  # tip - during a rollback those differ, and comparing against the tip would
  # report drift on a host that is exactly right.
  #
  # Production only. No other host runs a receiver, and one reporting a digest
  # would be the surprise rather than one that does not.
  if [ "$label" = production ]; then
    local live_hash want_hash
    live_hash=$(echo "$health" | sed -n 's/^webhook //p')
    if [ -z "$live_hash" ]; then
      fail "health reports no webhook digest - set WEBHOOK_FILE in the checkout's .env"
    elif [ -z "$deployed" ]; then
      warn "webhook digest ${live_hash:0:12}, but no deployed commit to compare it against"
    elif ! want_hash=$(git show "$deployed:deploy/webhook.php" 2>/dev/null | sha256sum | cut -d' ' -f1) \
      || [ -z "$want_hash" ]; then
      warn "cannot read deploy/webhook.php at ${deployed:0:7} - is the checkout shallow?"
    elif [ "$live_hash" = "$want_hash" ]; then
      ok "webhook.php matches ${deployed:0:7}"
    else
      fail "webhook.php has drifted: serving ${live_hash:0:12}, ${deployed:0:7} has ${want_hash:0:12} - reinstall it (deploy/README.md)"
    fi
  fi

  # ---- the cron jobs ----
  local jobs
  jobs=$(echo "$health" | sed -n 's/^job //p')
  if [ -z "$jobs" ]; then
    fail "health reports no cron job at all - is pfg-cron-run wired into the crontab?"
  fi
  while read -r job age status; do
    [ -n "$job" ] || continue
    if [ "$status" != "0" ]; then
      fail "$job last exited $status"
    elif [ "$age" -gt "$MAX_AGE" ]; then
      fail "$job last finished $((age / 3600))h ago, over the ${MAX_AGE}s limit"
    else
      ok "$job ran $((age / 3600))h ago"
    fi
  done <<< "$jobs"
}

# ---------------------------------------------------------------------------
# Certificate expiry - reported for both, enforced for neither.
# ---------------------------------------------------------------------------
check_cert() {
  local label="$1" connect="$2"
  command -v openssl >/dev/null || return 0
  local end days
  end=$(echo | openssl s_client -connect "$connect" -servername "$SITE_HOST" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  [ -n "$end" ] || { warn "$label certificate: could not be read"; return 0; }
  days=$(( ( $(date -u -d "$end" +%s) - $(date -u +%s) ) / 86400 ))
  if [ "$days" -lt "$CERT_WARN_DAYS" ]; then
    warn "$label certificate expires in $days days ($end)"
  else
    ok "$label certificate has $days days left"
  fi
}

WHICH="${1:-both}"

if [ "$WHICH" = both ] || [ "$WHICH" = production ]; then
  check_host "production" "$PROD_BASE"
  check_cert "production" "proxyforgame.com:443"
fi

if [ "$WHICH" = both ] || [ "$WHICH" = standby ]; then
  # --resolve puts the request on the standby while it still asks for the vhost
  # name; --insecure because that name's certificate is production's business.
  check_host "standby" "https://$SITE_HOST" \
    --resolve "$SITE_HOST:443:$STANDBY_IP" --insecure
  check_cert "standby" "$STANDBY_IP:443"
fi

echo
if [ "$FAILED" = 0 ]; then
  echo "All checks passed."
else
  echo "Something is wrong above."
fi
exit "$FAILED"
