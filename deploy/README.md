# Deploying ProxyForGame

A commit reaches the site by being pushed to `main` and passing CI. Nothing else
deploys anything: there is no manual copy step, no second repository, and no
build.

Credentials, SSH access details and firewall rules are deliberately **not** here
— they stay in the untracked `docs/vps-deploy-notes.md`. Everything in this file
is safe to read in a public repository.

## How a deploy happens

```
git push main
     │
     ▼
GitHub Actions "CI"  ──── green ────▶  webhook: workflow_run
     │                                        │
   red │                                      ▼
     ▼                          webhooks.proxyforgame.com/webhook.php
 nothing deploys                    verify HMAC → check the payload
                                            │
                                            ▼
                                    pfg-sync --sha <commit>
                                    fetch → reset --hard → clean -fd
                                    → migrate → smoke test → mail on failure
```

The webhook subscribes to `workflow_run`, not `push`. That is the whole reason
CI can gate the deploy: a `push` subscription would fire at the same moment the
test run started, and the site would get code no one had tested yet.

The receiver never runs git itself. It validates and hands a commit to
`pfg-sync`, which the hourly timer and a human at a shell also use, so a checkout
is only ever updated by one piece of code.

## The pieces

| File | Runs on | What it is |
|---|---|---|
| `webhook.php` | production only | The GitHub receiver. Lives in the `webhooks.proxyforgame.com` document root, **not** in the site checkout. |
| `pfg-sync` | both hosts | Brings a checkout to a commit and proves the site still serves. The only writer. |
| `pfg-notify` | both hosts | Mails a failure. Speaks SMTP itself rather than reusing `www/api/mail.inc.php`, so the alarm does not depend on the tree it is complaining about. |
| `pfg-changelog-apply` | both hosts | Pipes `changelog.sql` into the host's database after a deploy. `pfg-sync` calls it; a failure is logged, not fatal. |
| `pfg-migrate` | both hosts | Applies pending `db/migrations/*.sql` and records them in `schema_migrations`. `pfg-sync` calls it before the smoke test; a failure **is** fatal and rolls the deploy back. |
| `cutover-prod.sh` | production | One-time move from the old Bitbucket checkout. `--dry-run` stops before anything live is touched. |
| `cutover-standby.sh` | standby | The same, plus introducing a document-root symlink the host did not have. |
| `rollback-prod.sh` | production | Undoes the cutover. Not the everyday rollback — see below. |
| `pfg-cron-run` | both hosts | Wraps a cron job and stamps when it last ran. See *Between deploys*. |
| `watchdog.sh` | nowhere — a runner, or a laptop | Checks both hosts from outside. Driven by `.github/workflows/watchdog.yml`. |

`pfg-sync`, `pfg-notify` and `pfg-cron-run` are installed **outside** the
checkout (`$DATA/bin/` on production, `/usr/local/bin/` on the standby). `pfg-sync`
resets the tree it would otherwise be running from, and bash reads a script as
it executes it — a self-update mid-run would make it read the second half of a
different file. The cost is that they do not update themselves; `pfg-sync` says
so when its installed copy has drifted from the one in the checkout.

`pfg-changelog-apply` and `pfg-migrate` are the exception: `pfg-sync` runs them
from **inside** the checkout (`<checkout>/deploy/…`). They do no git work and run
only once the reset has finished and the tree is quiescent, so the read-half-a-
file hazard does not apply — and running the in-checkout copy means each always
matches the release just deployed, with nothing to reinstall.

`webhook.php` sits outside the checkout for a different reason — it belongs to
another vhost's document root. A deploy updates the copy in `deploy/` and leaves
the running one untouched, so a change to the receiver has to be reinstalled by
hand:

```
install -m 644 <checkout>/deploy/webhook.php <data>/www/webhooks.proxyforgame.com/
```

**Forgetting that step is now an alarm rather than a silence.**
`ajax.php?service=health` publishes the sha256 of the installed receiver — the
digest only, never the file, and a digest of something already public in this
repository tells an outsider nothing. The watchdog compares it against
`deploy/webhook.php` *at the commit that host reports as deployed*, so a
rollback does not read as drift, and fails the run when the two differ.

The path comes from `WEBHOOK_FILE` in the checkout's `.env`, the same way
`JOB_STAMP_DIR` does. Production only: everywhere else the variable is unset,
health reports `"webhook": null`, and the watchdog does not look. On production
an unset variable is itself a failure — a receiver nobody can see the version of
is the state this check exists to end.

## The two hosts

| | production | standby |
|---|---|---|
| address | `88.218.248.47` | `89.124.110.192` |
| in DNS | yes — `proxyforgame.com` | no |
| panel | ISPmanager, **no root** (uid 1012) | plain Ubuntu, root |
| checkout | `/var/www/www-proxyforgame/data/deploy/proxyforgame.com-gh` | `/var/www/proxyforgame-gh` |
| document root | `~/www/proxyforgame.com` → `<checkout>/www` | `/var/www/proxyforgame-docroot` → `<checkout>/www` |
| PHP | 8.2 (`/opt/php82/bin/php`) — the pin, see [`.php-version`](../.php-version) | 8.5 (`/usr/bin/php`), distribution default — [ADR-0001](../docs/adr/0001-php-version-alignment.md) |
| cron owner | `www-proxyforgame` | `www-data` |
| deploy log | `<data>/logs/deploy.log` | `/var/log/pfg-cron.log` |
| trigger | webhook, plus an hourly reconcile | five-minute timer |

Both are Apache 2.4 with mod_php and a MariaDB of their own. No Docker — that is
a local-dev convenience only (`docs/adr/0002-docker-local-dev.md`). Opcache is on
with `validate_timestamps` and `revalidate_freq=2`, so a deploy needs no cache
flush — new files are picked up within two seconds.

### Why the standby runs a different PHP

The pinned version is 8.2 — production's, recorded in [`.php-version`](../.php-version)
and read from there by CI. The standby runs 8.5 because that is what Ubuntu
26.04 ships and there is no supported apt path to 8.2 on it (`ondrej/php` has no
`resolute` suite). **Do not try to downgrade it by hand.**

The consequence, spelled out in [ADR-0001](../docs/adr/0001-php-version-alignment.md):
the standby is a warm serving spare and a forward-compatibility canary, not a
version-faithful rehearsal of production. A failover onto it is also a PHP
upgrade. `deploy/watchdog.sh` enforces this asymmetrically — production must
equal `.php-version`, the standby must only not be *older* than it.

**The document root is a symlink on both hosts.** That is what makes the cutover
atomic and its rollback instant, and it is what issue #14 (release directories)
will build on.

### Why the webhook URL is `http://`, not `https://`

`webhooks.proxyforgame.com` has no certificate of its own: the host answers
443 with the default vhost's `CN=battlesim.logserver.net`, so TLS to that name
fails outright. Issuing one needs the ISPmanager panel — there is no root and no
certbot here. Until that happens the webhook is registered as
`http://webhooks.proxyforgame.com/webhook.php`; GitHub accepts it with a
warning.

What that does *not* leak is the secret. GitHub never transmits it — it sends an
HMAC signature over the body, and `webhook.php` recomputes it. That already makes
this stricter than the Bitbucket scheme it replaces, which put the key in the
query string and therefore in every access log. What is in the clear is the
payload (commit SHAs and branch names of a public repository) and the chance for
anyone on the path to replay a captured delivery, which can only ever redeploy an
older commit that CI had already passed.

Switching to `https://` once the certificate exists is a URL edit in the GitHub
webhook settings. Nothing in this directory changes.

### Why the standby uses a timer instead of a webhook

It has no public hostname at all, so there is no address for GitHub to call. A
timer needs no inbound path. Five minutes rather than one because the host takes
no traffic; being a few minutes behind costs it nothing.

### Why production *also* has a timer

GitHub delivers a webhook at most once. A network blip, a 500, an expired
certificate — the delivery is marked failed and may not be retried. Production
would then sit on an old commit behind a green CI and a site that looks
perfectly healthy, and the divergence would be found by accident.

The hourly `pfg-sync` run closes that hole. It asks GitHub for the newest
`main` commit whose CI **passed** — not for the tip of `main` — so it is exactly
as safe as the webhook, and it is idempotent: with the webhook working it finds
nothing to do and prints nothing.

## Rolling back

**Normal case — roll forward.** `git revert`, push, CI goes green, the site
updates. This is the default because it leaves the history honest and needs no
special mechanism.

**Faster — put a specific commit back.** Actions → *Deploy* → Run workflow, and
give it the full commit SHA. The workflow checks that the commit exists and is
an ancestor of `main`, and only then tells the server; a bad SHA fails the job
and nothing is dispatched. A rollback target must be an ancestor of `main` —
`pfg-sync` checks that again on the host and refuses otherwise.

The route there is worth knowing, because the obvious ones are closed. A
`workflow_run` payload carries no inputs, so it cannot name a commit of your
choosing. `workflow_dispatch` and `repository_dispatch` both do — and GitHub
will not deliver either to a repository webhook:

```
422 These events are not allowed for this hook: workflow_dispatch
422 These events are not allowed for this hook: repository_dispatch
```

Both are GitHub App events. What a repo hook may receive, and what exists for
exactly this, is **`deployment`**: `deploy.yml` creates one for the verified SHA
in the `production` environment, and the receiver takes the commit from
`deployment.sha`. Deployments from any other environment are logged and ignored.

**A rollback holds both hosts, and lapses on its own.** The deployment carries
the sha of `main`'s tip at dispatch time in `payload.pinned_tip`, and green-mode
`pfg-sync` treats it as a **pin**: while `main` is still that commit, the walk
does not climb back to the tip and both hosts stay on the rolled-back code.

That pin is what makes the lever hold at all. Green mode runs on a timer on both
hosts — hourly on production, every five minutes on the standby — and the walk
resolves to the newest *green* commit of `main`. Without the pin the standby was
back on the tip within five minutes, and production undid its own rollback at
the next hourly reconcile, so the lever was good for at most 59 minutes there.

**Clearing it needs nothing.** The pin only applies while `main` is unchanged, so
the normal repair — `git revert`, push, CI green — lapses it as a side effect and
both hosts roll forward again. To resume immediately without a fix, dispatch
*Deploy* at the current tip: a deployment for the tip is a roll-forward, not a
rollback, and no pin is derived from it.

Two smaller consequences:

- Production still moves at once, because the `deployment` webhook reaches it and
  a `--sha` sync is an explicit instruction that ignores pins. The standby moves
  on its next five-minute run.
- `pfg-sync --check` honours the pin too, so a correctly pinned host does not
  read as drifted to the watchdog.

A deployment created before `pinned_tip` existed carries no pin, and is ignored.

**Last resort — at a shell:** `pfg-sync --sha <sha>`.

## What `pfg-sync` will not do

- **It never runs `git pull`.** A pull can merge, and merges are how the old
  Bitbucket checkout accumulated 26 commits that existed nowhere else. A
  `reset --hard` makes the checkout a mirror that cannot drift.
- **`git clean -fd` must never gain `-x`.** The gitignored `.env` sits in the
  checkout root and is the one file there that cannot be recreated from git.
  `pfg-sync` also copies `.env` aside before every reset and puts it back if the
  reset moved or removed it — `.env` was a *tracked* file until commit `8ac690a`,
  so a reset onto older history would otherwise overwrite it with the committed
  placeholder, and the reset back would delete it.
- **It refuses anything that is not a hex commit id**, and in `--sha` mode also
  anything that is not an ancestor of `origin/main`. A SHA arrives from the
  public internet and ends up on a command line, however well signed the
  delivery was.
- **In green mode it never deploys ahead of CI, or behind it.** The target is
  the tip of `origin/main` if that commit's CI has gone green, else the newest
  ancestor whose has — resolved by asking GitHub about a specific commit, not by
  trusting the order of the runs list (which once served a six-month-old run as
  "newest" and cost an afternoon).
- **A deploy whose smoke test fails is rolled back** to the commit it came from,
  then re-smoked. A broken commit left live is worse than a missed update.

## After every deploy

`pfg-sync` fetches five URLs and fails loudly if any of them is wrong:

- `/`, `/ru/`, `/ogame/calc/flight.php`, `/ogame/calc/costs.php`
- `ajax.php?service=populatedSystems&country=ru&universe=268`

`/ru/` is in the list because it is the only one that exercises `.htaccess` —
if `AllowOverride` ever stops applying, every other page still returns 200 while
the language routing is silently gone. The `ajax.php` call is there because a
static page cannot show that `.env` survived or that MySQL is answering.

## Between deploys

A deploy-time smoke test only ever runs at deploy time. Between two deploys
nothing looks at either host, and the standby - which has no public name, so no
uptime service can be pointed at it - would be watched by nobody at all.

Three pieces close that:

| | |
|---|---|
| `deploy/pfg-cron-run` | Wraps a cron job and writes a stamp: when it started, when it finished, with what exit status |
| `ajax.php?service=health` | Reports the deployed commit and those stamps, with each job's age worked out server-side |
| `.github/workflows/watchdog.yml` | Twice an hour, runs `deploy/watchdog.sh`, which checks both hosts from outside and fails the run when something is wrong |

A failed run is the alarm - GitHub mails it to whoever last changed the
schedule in that workflow file. There is no third-party monitoring account
involved anywhere in this.

**Why a stamp file and not a log line.** A job that runs and fails writes to its
log. A job that stops being run - cron died, the crontab was rewritten, the host
is down - writes nothing at all, and nothing is exactly what a log tells you.
The stamps make silence measurable.

**Why the stamps live outside the checkout.** `pfg-sync` runs `git clean -fd` on
every deploy, so anything untracked left inside the checkout is deleted the next
time `main` moves. `STAMP_DIR` therefore points somewhere else, and the web user
needs to be able to read it - the health service reads the files directly.

The path is named twice, once per reader: `STAMP_DIR` in `/etc/pfg-cron.conf`
(what `pfg-cron-run` writes to) and `JOB_STAMP_DIR` in the checkout's `.env`
(what `ajax.php?service=health` reads back). They must match. If `health`
reports `"jobs": {}` on a host whose crons are visibly running, `JOB_STAMP_DIR`
is missing from that host's `.env`.

The crontab lines name the job and then the command:

```
0 0 * * * /usr/local/bin/pfg-cron-run uni-list /usr/bin/php .../uni.list.cron.php >> log 2>&1
```

The job name is what appears in the health report and in the watchdog's output.
`pfg-cron-run` never changes a job's exit status and never stops it running: a
missing config, an unwritable stamp directory or an unreachable ping host are
reported on stderr and otherwise ignored.

**What the watchdog checks per host**: `/` and `/ru/` answer 200 with a real
page, `populatedSystems` answers with data (which is `.env` plus MySQL), the
deployed commit equals the newest commit of `main` whose CI passed - with a
fifteen-minute grace, since production deploys on a webhook and the standby
polls every five minutes - and every reported job finished within its window,
with status 0. The `php` field from the health report is checked against
`.php-version`: production must match it exactly, the standby must only not be
older (see ADR-0001). Certificate expiry is printed for both hosts but fails
neither: production renews itself, and the standby's is a known manual
procedure.

`bash deploy/watchdog.sh` runs the same checks from a laptop; `production` or
`standby` as an argument limits it to one host. It needs `curl`, `node` and,
for the commit comparison, `gh`.

**The standby's certificate.** It expires 2026-10-07 and cannot renew itself:
the HTTP-01 challenge for `proxyforgame.com` goes wherever that name resolves,
which is production. The decision on record is to leave it. During a failover
DNS is pointed at the standby anyway, and `certbot -d proxyforgame.com` then
works there like it does anywhere. Until that day the standby simply serves an
expired certificate to the few clients that reach it by IP.

## Failing over to the standby

There is no automatic failover and no shared state. Moving the site to the
standby is a manual sequence, and it is lossy - read the last point before
starting.

1. **Point DNS at it.** `proxyforgame.com` and `www.proxyforgame.com` to
   `89.124.110.192`. Nothing on either host has to change for this: the standby
   already serves that vhost, which is why its `.com` configuration was left in
   place after the cutover.
2. **Reissue the certificate**, once the name actually resolves there:
   `certbot --apache -d proxyforgame.com -d www.proxyforgame.com`. Until DNS
   moved, this could not work - the HTTP-01 challenge went to production - which
   is why the standby's certificate is allowed to lapse (issue #17). With a
   valid certificate in place, `SMOKE_INSECURE=1` can come out of
   `/etc/pfg-sync.conf`.
3. **Expect a slower pipeline.** The GitHub webhook points at production, so
   while it is down a push reaches the site on the standby's five-minute timer
   instead of within seconds. Nothing else about deploys changes.
4. **The databases are separate and nothing replicates between them.** Each host
   has its own MariaDB. `population_data` and the universe lists rebuild
   themselves from the daily crons, so those catch up on their own. The in-app
   changelog catches up too — `pfg-changelog-apply` runs on both hosts whenever a
   deploy moves `HEAD` and its statements are upserts (see *The in-app changelog*
   below), so the standby holds every release that has been pushed. Anything else
   written on production since the split is simply not there. This is the real
   cost of a failover, and the reason it is a decision rather than a reflex.

## Database changes

Schema changes are versioned SQL files in `db/migrations/`, applied by the
deploy: `pfg-sync` runs `deploy/pfg-migrate` after the reset and **before** the
smoke test, on both hosts, and records each file in `schema_migrations`. A
failure is fatal — the deploy is rolled back to the previous commit and mailed,
because the code just deployed may need the schema. Full rules for writing one:
`db/migrations/README.md`.

**A migration lands seconds before the code that needs it, so it must be
expand-only and backward compatible with the code already deployed** — add
columns and tables, never drop or rename something the running code still uses.
Drop/rename is a separate migration a release later.

`pfg-migrate` connects with `DB_HOST`/`DB_NAME` from the checkout's `.env` and
the migration user from `DB_DDL_USER`/`DB_DDL_PASS` when set, else
`DB_USER`/`DB_PASS`. That user needs **DDL and DML** on the database (the runner
writes the `schema_migrations` row, and a migration may backfill data).
Production's app user already has both, so it leaves the `DB_DDL_*` pair unset.
The standby's `pfg_app` has neither DDL nor — as it turned out — INSERT on new
tables, so its `.env` points at `pfg_ddl@localhost`, granted
`SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,DROP,REFERENCES` on
`og_proxyforgame`.*.

**Recovery only:** applying a migration by hand — `mysql < db/migrations/NNNN_*.sql`
then `INSERT INTO schema_migrations …` — is for when the deploy-time apply failed
and you are fixing forward. The standby needs the root `mysql` client over its
unix socket for this.

## The in-app changelog

The sidebar changelog *is* carried by the deploy, unlike every other database
change. `changelog.sql` is committed (it used to be git-ignored), so it travels
with the checkout, and `pfg-sync` pipes it into the host's database through
`pfg-changelog-apply` after every successful deploy.

- **It runs whenever a deploy actually moves `HEAD`, on both hosts** — and when a
  `--sha` is re-asserted by the webhook or a rollback. Not on an idle green-mode
  reconcile, so the standby's five-minute timer stays quiet when nothing changed.
  Every statement in `changelog.sql` is `insert … on duplicate key update`, so a
  host that already has the entry writes nothing and one that is behind catches
  up on its next sync. This is what keeps the standby's copy current without a
  manual step.
- **A failure is not fatal.** The site code is already live when it runs; a
  failure means the sidebar rows lag one release, logged as `WARNING: changelog
  apply failed`, nothing more.
- **Credentials come from the checkout's `.env`** (`DB_*`), the same file the app
  reads. The password goes through `MYSQL_PWD`, and `--default-character-set=utf8`
  is forced because production's mysql client defaults to latin1 and would
  otherwise double-encode every Cyrillic row.
- **What still is not automatic:** writing the release. `make changelog-release`
  and `/translate-changelog` are run locally; the deploy only applies what those
  produced and committed. `changelog.sql` holds **only the latest release** — a
  brand-new database has no changelog history, which matches how it worked
  before.

## Traps that have already cost time

- **`population_data.timestamp` is not a run time.** It is the `timestamp`
  attribute of Gameforge's `universe.xml`. For when the job last ran, use
  `information_schema.tables.UPDATE_TIME` — and note InnoDB refreshes that
  lazily, so it is not a write confirmation for a run you just triggered. Use
  the job's own log for that. The `updated_at` column added in July exists
  because of this.
- **Cron redirections silently swallowed output for six months.** A line ending
  `>> log 2>&1 >/dev/null 2>&1` re-points both descriptors after the log was
  opened. With `MAILTO=""` on top, nothing was visible anywhere.
- **The standby answers only over HTTPS, even on loopback.** Port 80 carries
  certbot's permanent redirect, so a plain `http://` smoke request gets a 301
  and never reaches the site. Its certificate is valid to 2026-10-07 — but
  renewal needs an HTTP-01 challenge, and `proxyforgame.com` resolves to
  production, so **that renewal will fail silently and the standby's smoke check
  will start failing on certificate validation.** Deal with it before October.
- **A document root that moves has to take its `<Directory>` block with it.**
  Apache matches that block against the path as configured, symlink and all, so
  pointing `DocumentRoot` at the new link while the block still names the old
  literal path leaves `AllowOverride` applying to nothing: `.htaccess` is
  ignored, every language prefix answers 404, and `/` and `*.php` keep answering
  200 — the failure looks like a routing bug, not a config one. Both standby
  vhosts now name the link in both places, which is also what makes the rollback
  a single `ln -sfn`. Worth remembering for issue #14.
- **The old deploy checkout carried files that were in no repository** —
  `api.php`, `funct.php`, `lftech.*`, `dev_flight.*`. All were dead: nothing
  referenced them and ten days of access logs showed zero hits. `cutover-prod.sh`
  tars them before they disappear.
- **The runs list is not ordered, and `.env` used to be tracked.** On 2026-08-29
  the standby's watchdog went red: no database, no cron stamps. `pfg-sync`'s
  target query (`runs?...&per_page=1`) had intermittently returned an arbitrary
  old successful run instead of the newest, and the five-minute timer kept
  resetting the checkout onto it and back. One of those old commits predated
  `8ac690a` "Stop tracking .env", where `.env` was a committed file — so
  `reset --hard` onto it wrote the placeholder over the real credentials, and
  the reset back deleted `.env` outright. Fixed on both sides: `pfg-sync` and
  `watchdog.sh` now resolve the target by asking GitHub about a specific commit
  (tip of main, then its ancestors), and `pfg-sync` preserves `.env` across
  every reset and rolls back a deploy whose smoke test fails.
