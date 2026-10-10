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
`pfg-sync`, which the five-minute timer and a human at a shell also use, so the
checkout is only ever updated by one piece of code.

## The pieces

| File | What it is |
|---|---|
| `webhook.php` | The GitHub receiver. Lives in the `webhooks.proxyforgame.com` document root, **not** in the site checkout. |
| `pfg-sync` | Brings the checkout to a commit and proves the site still serves. The only writer. |
| `pfg-notify` | Mails a failure. Speaks SMTP itself rather than reusing `www/api/mail.inc.php`, so the alarm does not depend on the tree it is complaining about. |
| `pfg-changelog-apply` | Pipes `changelog.sql` into the database after a deploy. `pfg-sync` calls it; a failure is logged, not fatal. |
| `pfg-migrate` | Applies pending `db/migrations/*.sql` and records them in `schema_migrations`. `pfg-sync` calls it before the smoke test; a failure **is** fatal and rolls the deploy back. |
| `pfg-cron-run` | Wraps a cron job and stamps when it last ran. See *Between deploys*. |
| `watchdog.sh` | Runs nowhere on the host — a runner, or a laptop. Checks the site from outside. Driven by `.github/workflows/watchdog.yml`. |

Until 2026-10 the site ran on two hosts, a production account and a standby;
the comments in `pfg-sync`, `pfg-migrate` and `pfg-changelog-apply` still name
them. Both names now resolve to the former standby, and *production* in those
comments means the account that was given up (ADR-0003).

`pfg-sync`, `pfg-notify` and `pfg-cron-run` are installed **outside** the
checkout, in `/usr/local/bin/`. `pfg-sync`
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
install -m 644 -o www-data -g www-data <checkout>/deploy/webhook.php /var/www/webhooks-proxyforgame/
```

**Forgetting that step is now an alarm rather than a silence.**
`ajax.php?service=health` publishes the sha256 of the installed receiver — the
digest only, never the file, and a digest of something already public in this
repository tells an outsider nothing. The watchdog compares it against
`deploy/webhook.php` *at the commit that host reports as deployed*, so a
rollback does not read as drift, and fails the run when the two differ.

The path comes from `WEBHOOK_FILE` in the checkout's `.env`, the same way
`JOB_STAMP_DIR` does. Locally and in CI the variable is unset and health reports
`"webhook": null`; on the site that is itself a failure — a receiver nobody can
see the version of is the state this check exists to end.

The receiver's own settings (the secret, the `pfg-sync` path, the log) are in
`/etc/pfg-webhook.conf`, readable by `www-data` only; the webhooks vhost points
`webhook.php` at it with `SetEnv PFG_WEBHOOK_CONF /etc/pfg-webhook.conf`.

## The host

| | |
|---|---|
| address | `89.124.110.192` |
| in DNS | `proxyforgame.net` (zone at Porkbun) and, until it is retired, `proxyforgame.com` (zone at FirstVDS); `www.` of each, and `webhooks.proxyforgame.com` |
| OS | Ubuntu 26.04, root |
| checkout | `/var/www/proxyforgame-gh` |
| document root | `/var/www/proxyforgame-docroot` → `<checkout>/www` |
| PHP | 8.5 (`/usr/bin/php`), the distribution's — and the pin, see [`.php-version`](../.php-version) and [ADR-0003](../docs/adr/0003-single-host-php-8-5.md) |
| database | MariaDB 11.8, local |
| cron owner | `www-data` |
| config | `/etc/pfg-sync.conf`, `/etc/pfg-cron.conf`, `/etc/pfg-webhook.conf` |
| deploy log | `/var/log/pfg-cron.log` (the webhook logs there too) |
| trigger | webhook, plus a five-minute reconcile |
| shell from the dev box | `bash scripts/pfg-ssh.sh standby '<cmd>'` |

Apache 2.4 with mod_php (prefork) and `mod_rewrite`, so `www/.htaccess` applies.
No Docker — that is a local-dev convenience only
(`docs/adr/0002-docker-local-dev.md`). Opcache is on with `validate_timestamps`
and `revalidate_freq=2`, so a deploy needs no cache flush — new files are picked
up within two seconds.

**The document root is a symlink.** That is what makes a cutover atomic and its
rollback instant, and it is what issue #14 (release directories) will build on.

The host carries an unrelated VPN service as well. It must not be disturbed,
which is also why the host is not rebuilt on a whim.

### Why there is also a timer

GitHub delivers a webhook at most once. A network blip, a 500, an expired
certificate — the delivery is marked failed and may not be retried. The site
would then sit on an old commit behind a green CI and look perfectly healthy,
and the divergence would be found by accident.

The five-minute `pfg-sync` run closes that hole. It asks GitHub for the newest
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

**A rollback holds, and lapses on its own.** The deployment carries the sha of
`main`'s tip at dispatch time in `payload.pinned_tip`, and green-mode `pfg-sync`
treats it as a **pin**: while `main` is still that commit, the walk does not
climb back to the tip and the site stays on the rolled-back code.

That pin is what makes the lever hold at all. Green mode runs on the five-minute
timer, and the walk resolves to the newest *green* commit of `main`. Without the
pin the site would be back on the tip within five minutes.

**Clearing it needs nothing.** The pin only applies while `main` is unchanged, so
the normal repair — `git revert`, push, CI green — lapses it as a side effect and
the site rolls forward again. To resume immediately without a fix, dispatch
*Deploy* at the current tip: a deployment for the tip is a roll-forward, not a
rollback, and no pin is derived from it.

Two smaller consequences:

- The site moves at once, because the `deployment` webhook reaches it and a
  `--sha` sync is an explicit instruction that ignores pins.
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
- **Green mode only rolls forward.** The walk stops at the commit already deployed
  and takes it without asking: the runs API now and then answers "no successful
  run" for a commit that has one, and from 2026-09-28 every such answer for the tip
  reset the host one commit back for a cycle — production for an hour, the standby
  for five minutes, several times a day. Going back is the pin's job (above). A
  consequence: a commit put live by hand with `--sha` stays until a newer commit of
  `main` goes green, even if its own CI is red.
- **A deploy whose smoke test fails is rolled back** to the commit it came from,
  then re-smoked. A broken commit left live is worse than a missed update.

## After every deploy

`pfg-sync` fetches five URLs and fails loudly if any of them is wrong:

- `/`, `/ru/`, `/ogame/calc/flight.php`, `/ogame/calc/costs.php`
- `ajax.php?service=populatedSystems&country=ru&universe=268`

The two calculator paths are the old `.php` addresses, which redirect to the
short `/<lang>/<calc>` ones; the smoke test follows the redirect, checks the page
behind it, and fails if the final URL has left `SMOKE_BASE`. Asking the old path
keeps the check valid for a rollback to a commit from before the short addresses.

`/ru/` is in the list because it exercises `.htaccess` — if `AllowOverride` ever
stops applying, `/` still returns 200 while the language routing is silently
gone. Since the short addresses, the calculator paths depend on `.htaccess` too:
their redirect lands on a URL only the rewrite rules can serve. The `ajax.php` call is there because a
static page cannot show that `.env` survived or that MySQL is answering.

## Between deploys

A deploy-time smoke test only ever runs at deploy time. Between two deploys
nothing else looks at the host.

Three pieces close that:

| | |
|---|---|
| `deploy/pfg-cron-run` | Wraps a cron job and writes a stamp: when it started, when it finished, with what exit status |
| `ajax.php?service=health` | Reports the deployed commit and those stamps, with each job's age worked out server-side |
| `.github/workflows/watchdog.yml` | Twice an hour, runs `deploy/watchdog.sh`, which checks the site from outside and fails the run when something is wrong |

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

**What the watchdog checks**, under each public name in turn (`SITE_NAMES` in
the script): `/` and `/ru/` answer 200 with a real page, `populatedSystems`
answers with data (which is `.env` plus MySQL), the deployed commit equals the
newest commit of `main` whose CI passed - with a fifteen-minute grace - the PHP
in the health report equals `.php-version`, the installed `webhook.php` matches
the repository's copy, and every reported job finished within its window, with
status 0. Each name is asked with full certificate verification, and a
certificate with under 14 days left fails the run: certbot renews 30 days
ahead, so that means renewal broke.

`bash deploy/watchdog.sh` runs the same checks from a laptop; a name as an
argument limits it to that name. It needs `curl`, `node` and, for the commit
comparison, `gh`.

## Rebuilding the host

There is no second host to fail over to. If this one is lost, a new one is
built. **Nothing in the database is irreplaceable**: `countries` and `servers`
come from `schema.sql`, `universes` and `population_data` from the daily crons,
the changelog from `changelog.sql`, and `schema_migrations` from the
migrations. The one file that cannot be recreated from git is the checkout's
`.env` — keep a copy off the host.

1. Ubuntu with Apache 2.4 (`mod_php`, `mod_rewrite`, `mod_ssl`), the PHP named in
   `.php-version` with `curl intl mbstring mysql xml`, MariaDB, git, certbot with
   the Apache plugin.
2. Clone the repository to `/var/www/proxyforgame-gh`, owned by `www-data`;
   `ln -sfn /var/www/proxyforgame-gh/www /var/www/proxyforgame-docroot`.
3. Restore `.env` into the checkout. Create the database and its users
   (`DB_USER` for the app, `DB_DDL_USER` with DDL and DML — see *Database
   changes*), import `schema.sql`, then run `deploy/pfg-migrate` and
   `deploy/pfg-changelog-apply`.
4. Vhosts for `proxyforgame.net` and `proxyforgame.com` (with their `www.`
   aliases) on the document-root link — the `<Directory>` block names the link
   too, see *Traps* — and for `webhooks.proxyforgame.com` on
   `/var/www/webhooks-proxyforgame`, with the `SetEnv` above.
5. Install `pfg-sync`, `pfg-notify` and `pfg-cron-run` into `/usr/local/bin/`
   and `webhook.php` into the webhooks root; write `/etc/pfg-sync.conf`,
   `/etc/pfg-cron.conf` (`STAMP_DIR=/var/lib/pfg/job-stamps`, readable by
   `www-data`) and `/etc/pfg-webhook.conf` (the secret is in the GitHub webhook
   settings — set a new one there if it is lost).
6. The `www-data` crontab: `uni.list.cron.php` and `get_population.php` under
   `pfg-cron-run` (see above), and `*/5 * * * * /usr/local/bin/pfg-sync`. Run
   both jobs once by hand so the pickers are not empty until midnight.
7. Point DNS at the new address, then `certbot --apache` for every name.
   `bash deploy/watchdog.sh` going green is the definition of done.

## Database changes

Schema changes are versioned SQL files in `db/migrations/`, applied by the
deploy: `pfg-sync` runs `deploy/pfg-migrate` after the reset and **before** the
smoke test, and records each file in `schema_migrations`. A
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
The app user, `pfg_app`, has neither DDL nor — as it turned out — INSERT on new
tables, so the `.env` points at `pfg_ddl@localhost`, granted
`SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,DROP,REFERENCES` on
`og_proxyforgame`.*.

**Recovery only:** applying a migration by hand — `mysql < db/migrations/NNNN_*.sql`
then `INSERT INTO schema_migrations …` — is for when the deploy-time apply failed
and you are fixing forward. It needs the root `mysql` client over the unix
socket.

## The in-app changelog

The sidebar changelog *is* carried by the deploy, unlike every other database
change. `changelog.sql` is committed (it used to be git-ignored), so it travels
with the checkout, and `pfg-sync` pipes it into the host's database through
`pfg-changelog-apply` after every successful deploy.

- **It runs whenever a deploy actually moves `HEAD`** — and when a `--sha` is
  re-asserted by the webhook or a rollback. Not on an idle green-mode reconcile,
  so the five-minute timer stays quiet when nothing changed. Every statement in
  `changelog.sql` is `insert … on duplicate key update`, so a database that
  already has the entry writes nothing and one that is behind catches up on its
  next sync.
- **A failure is not fatal.** The site code is already live when it runs; a
  failure means the sidebar rows lag one release, logged as `WARNING: changelog
  apply failed`, nothing more.
- **Credentials come from the checkout's `.env`** (`DB_*`), the same file the app
  reads. The password goes through `MYSQL_PWD`, and `--default-character-set=utf8`
  is forced because a mysql client that defaults to latin1 (the old production
  account's did) would otherwise double-encode every Cyrillic row.
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
- **The host answers only over HTTPS, even on loopback.** Port 80 carries
  certbot's permanent redirect, so a plain `http://` smoke request gets a 301
  and never reaches the site. The smoke test therefore asks
  `https://proxyforgame.net` with `--resolve` onto `127.0.0.1`, and verifies the
  certificate.
- **A document root that moves has to take its `<Directory>` block with it.**
  Apache matches that block against the path as configured, symlink and all, so
  pointing `DocumentRoot` at the new link while the block still names the old
  literal path leaves `AllowOverride` applying to nothing: `.htaccess` is
  ignored, every language prefix answers 404, and `/` and `*.php` keep answering
  200 — the failure looks like a routing bug, not a config one. Both site
  vhosts name the link in both places, which is also what makes the rollback a
  single `ln -sfn`. Worth remembering for issue #14.
- **The old deploy checkout carried files that were in no repository** —
  `api.php`, `funct.php`, `lftech.*`, `dev_flight.*`. All were dead: nothing
  referenced them and ten days of access logs showed zero hits. The one-time
  cutover script tarred them before they disappeared.
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
