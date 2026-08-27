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

FAILED=0
fail() { printf '  FAIL %s\n' "$*"; FAILED=1; }
ok()   { printf '  ok   %s\n' "$*"; }
warn() { printf '  warn %s\n' "$*"; }

for tool in curl node; do
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
    for (const [name, job] of Object.entries(d.jobs || {})) {
      console.log("job " + name + " " + job.ageSeconds + " " + job.status);
    }
  ' "$1"
}

read_newest_green() {
  node -e '
    const fs = require("fs");
    let d;
    try { d = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch (e) { process.exit(1); }
    const run = (d.workflow_runs || [])[0];
    if (!run) process.exit(1);
    console.log(run.head_sha + " " + run.updated_at);
  ' "$1"
}

# ---------------------------------------------------------------------------
# What both hosts should be running: the newest commit of main whose CI passed.
# Comparing against the tip of main instead would cry every time a push is
# still building, and every time main is red.
# ---------------------------------------------------------------------------
TARGET=""
TARGET_AGE=""
if command -v gh >/dev/null; then
  RUNS_JSON=$(mktemp)
  gh api "repos/$REPO/actions/workflows/$CI_WORKFLOW/runs?branch=main&event=push&status=success&per_page=1"     > "$RUNS_JSON" 2>/dev/null || true
  NEWEST=$(read_newest_green "$RUNS_JSON" || true)
  rm -f "$RUNS_JSON"
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
