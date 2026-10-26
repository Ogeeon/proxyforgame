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
                                    fetch → build releases/<commit> → migrate
                                    → flip the links → smoke test
                                    → mail on failure
```

The webhook subscribes to `workflow_run`, not `push`. That is the whole reason
CI can gate the deploy: a `push` subscription would fire at the same moment the
test run started, and the site would get code no one had tested yet.

The receiver never runs git itself. It validates and hands a commit to
`pfg-sync`, which the five-minute timer and a human at a shell also use, so a
release is only ever written by one piece of code.

## The pieces

| File | What it is |
|---|---|
| `webhook.php` | The GitHub receiver. Lives in the `webhooks.proxyforgame.com` document root, **not** in the site's releases. |
| `pfg-sync` | Builds the release a commit names, migrates it, flips the symlink and proves the site still serves. The only writer. |
| `pfg-notify` | Mails a failure. Speaks SMTP itself rather than reusing `www/api/mail.inc.php`, so the alarm does not depend on the tree it is complaining about. |
| `pfg-changelog-apply` | Pipes `changelog.sql` into the database after a deploy. `pfg-sync` calls it; a failure is logged, not fatal. |
| `pfg-migrate` | Applies pending `db/migrations/*.sql` and records them in `schema_migrations`. `pfg-sync` calls it from the new release, before the flip; a failure **is** fatal - and cheap: the site has not switched yet. |
| `pfg-cron-run` | Wraps a cron job and stamps when it last ran. See *Between deploys*. |
| `watchdog.sh` | Runs nowhere on the host — a runner, or a laptop. Checks the site from outside. Driven by `.github/workflows/watchdog.yml`. |
| `pfg-mcp.service` | The MCP server (`mcp/server.js`) as a systemd service. See *The MCP server*. |
| `pfg-mcp-restart.path`, `.service` | Restart that service when `pfg-sync` reports a deploy. |
| `apache-mcp.conf` | Proxies `/mcp` to the service; included in both site vhosts. |

Until 2026-10 the site ran on two hosts, a production account and a standby;
the comments in `pfg-migrate` and `pfg-changelog-apply` still name
them. Both names now resolve to the former standby, and *production* in those
comments means the account that was given up (ADR-0003).

`pfg-sync`, `pfg-notify` and `pfg-cron-run` are installed **outside** the
releases, in `/usr/local/bin/`. For `pfg-sync` the reason is that bash reads a
script as it executes it, and a release may be pruned, or flipped away from,
under a running one - a self-update mid-run could make it read the second half
of a different file. The cost is that they do not update themselves;
`pfg-sync` says so when its installed copy has drifted from the one in the
current release.

`pfg-changelog-apply` and `pfg-migrate` are the exception: `pfg-sync` runs them
from **inside** the release it is deploying (`<release>/deploy/…`). They do no
git work and run only once the worktree is whole, so the read-half-a-
file hazard does not apply — and running the in-release copy means each always
matches the code just deployed, with nothing to reinstall.

`webhook.php` sits outside the releases for a different reason — it belongs to
another vhost's document root. A deploy updates the copy in `deploy/` and leaves
the running one untouched, so a change to the receiver has to be reinstalled by
hand:

```
install -m 644 -o www-data -g www-data /var/www/pfg-current/deploy/webhook.php /var/www/webhooks-proxyforgame/
```

**Forgetting that step is now an alarm rather than a silence.**
`ajax.php?service=health` publishes the sha256 of the installed receiver — the
digest only, never the file, and a digest of something already public in this
repository tells an outsider nothing. The watchdog compares it against
`deploy/webhook.php` *at the commit that host reports as deployed*, so a
rollback does not read as drift, and fails the run when the two differ.

The path comes from `WEBHOOK_FILE` in the release's `.env`, the same way
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
| in DNS | `proxyforgame.com` (the main name; zone at FirstVDS) and `proxyforgame.net` (zone at Porkbun); `www.` of each, and `webhooks.proxyforgame.com` |
| OS | Ubuntu 26.04, root |
| object store | `/var/www/pfg-objects.git` — bare; the only thing that is fetched |
| releases | `/var/www/pfg-releases/<sha>` — one worktree per deployed commit |
| current | `/var/www/pfg-current` → the live release; the crontab's jobs and the MCP server go through it |
| shared `.env` | `/var/www/pfg-shared/.env` — the one file git cannot recreate; every release links to it |
| document root | `/var/www/proxyforgame-docroot` → the current release's own `www` |
| PHP | 8.5 (`/usr/bin/php`), the distribution's — and the pin, see [`.php-version`](../.php-version) and [ADR-0003](../docs/adr/0003-single-host-php-8-5.md) |
| database | MariaDB 11.8, local |
| cron owner | `www-data` |
| config | `/etc/pfg-sync.conf`, `/etc/pfg-cron.conf`, `/etc/pfg-webhook.conf` |
| deploy log | `/var/log/pfg-cron.log` (the webhook logs there too) |
| trigger | webhook, plus a five-minute reconcile |
| shell from the dev box | `bash scripts/pfg-ssh.sh standby '<cmd>'` |
| Node | the distribution's `nodejs`, 20 or newer — only for the MCP server |
| MCP server | `pfg-mcp.service` on `127.0.0.1:8787`, public as `https://<name>/mcp` |

Apache 2.4 with `mpm_event` and PHP-FPM (`proxy_fcgi`, the stock
`php8.5-fpm` pool sized to `pm.max_children = 10` for the 1-CPU / 1 GB box),
plus `mod_rewrite`, `mod_expires` and `mod_headers`, so `www/.htaccess` applies
in full - rewrites and the browser-cache rules. `Protocols h2 http/1.1`
(`conf-available/http2-protocols.conf`) serves HTTP/2; under prefork it would be
silently off, which is why mod_php was retired on 2026-10-10. PHP settings live
in `/etc/php/8.5/fpm/php.ini` (`expose_php = Off`, `pcre.jit = 0`); the
`apache2/php.ini` beside it is no longer read. Rolling back to prefork is
`a2dismod mpm_event proxy_fcgi http2 && a2disconf php8.5-fpm http2-protocols &&
a2enmod mpm_prefork php8.5 && systemctl restart apache2`.
No Docker — that is a local-dev convenience only
(`docs/adr/0002-docker-local-dev.md`). Opcache is on with `validate_timestamps`
and `revalidate_freq=2`, so a deploy needs no cache flush — new files are picked
up within two seconds.

**The document root is a symlink, and so is the current release.** A deploy
builds `releases/<sha>` aside and flips two links onto it, each with one
atomic rename — `ln -s <new> <link>.tmp && mv -T <link>.tmp <link>`, never
`ln -sfn`, whose unlink+symlink leaves an instant with no link at all:
`pfg-current` (what the crontab's jobs and the MCP server go through) and
`proxyforgame-docroot` (what Apache serves). A request is served the whole old
release or the whole new one, never a half-updated tree, and a rollback is
the same two renames pointed at a release that already exists.

The document root link points at the release's **own** `www`, not through
`pfg-current`: opcache keeps serving the compiled code of a path it has
already cached — `__DIR__` folded in at compile time — and an indirection
whose target changes while the path stays the same leaves every PHP file
running the old release long after the flip. One release, one set of paths,
and the new code is what runs from the first request.

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

**Last resort — at a shell:** `pfg-sync --sha <sha>` — it rebuilds the release
if it was pruned and flips onto it. The flip alone, when the release still
exists, is enough:

```
ln -s /var/www/pfg-releases/<sha> /var/www/pfg-current.tmp && \
  mv -T /var/www/pfg-current.tmp /var/www/pfg-current
```

That is what a smoke failure does for itself; it does not rerun migrations or
mail anyone, and the next green reconcile five minutes later puts the site back
on the newest green commit unless a dispatched rollback pins it.

## What `pfg-sync` will not do

- **It never runs `git pull`.** A pull can merge, and merges are how the old
  Bitbucket checkout accumulated 26 commits that existed nowhere else. A
  detached worktree at an exact sha is a snapshot that cannot drift, and there
  is no `git clean` at all — a fresh worktree has nothing stray to sweep.
- **A deploy never writes to `.env`.** The one file that cannot be recreated
  from git lives once in `/var/www/pfg-shared/.env`, and every release links
  to it. The old dance — copy `.env` aside before every reset, put it back
  after — died with the resets; `.env` was a *tracked* file until commit
  `8ac690a`, which is why a release of an older commit can still find a
  committed placeholder where the link belongs, and `pfg-sync` replaces it
  with the link when building the release.
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
- **A deploy whose smoke test fails is flipped back** to the release it came
  from, then re-smoked; the failed release is kept for inspection. A broken
  commit left live is worse than a missed update. A migration failure is
  cheaper still: it happens before the flip, so the site never leaves the old
  release at all.

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

**Why the stamps live outside the releases.** Every deploy flips to a fresh
worktree and prunes old ones, so anything left inside a release disappears with
it. `STAMP_DIR` therefore points somewhere else, and the web user
needs to be able to read it - the health service reads the files directly.

The path is named twice, once per reader: `STAMP_DIR` in `/etc/pfg-cron.conf`
(what `pfg-cron-run` writes to) and `JOB_STAMP_DIR` in the release's `.env`
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
status 0, and apt has been patching the host (see *OS patching*). Each name is asked with full certificate verification, and a
certificate with under 14 days left fails the run: certbot renews 30 days
ahead, so that means renewal broke.

`bash deploy/watchdog.sh` runs the same checks from a laptop; a name as an
argument limits it to that name. It needs `curl`, `node` and, for the commit
comparison, `gh`.

## OS patching

The host patches itself with `unattended-upgrades`: security pocket only, no
automatic reboot (one host, no standby — a reboot at a random hour is an
outage). It needs `apt-daily.timer` and `apt-daily-upgrade.timer` **enabled**;
`20auto-upgrades` alone does nothing without them, and on this host they were
off for months with an empty log (found 2026-10-23).

`ajax.php?service=health` publishes three ages from `PATCH_STAMP_DIR`
(`/var/lib/apt/periodic`) and `REBOOT_FLAG_FILE` (`/var/run/reboot-required`),
both in the release's `.env`. The watchdog fails the run when `apt update` or
`unattended-upgrade` last ran over three days ago, or when a reboot has been
pending for over a week. A reboot flag younger than that is normal: reboot in a
quiet hour, then check `systemctl --failed` and the site.

Ubuntu fixes security bugs by backporting, so `php8.5 8.5.4-0ubuntu1.5` can
carry a fix that upstream shipped as 8.5.12. Check the CVE in the Ubuntu
tracker, not the version number.

## Rebuilding the host

There is no second host to fail over to. If this one is lost, a new one is
built. **Nothing in the database is irreplaceable**: `countries` and `servers`
come from `schema.sql`, `universes` and `population_data` from the daily crons,
the changelog from `changelog.sql`, and `schema_migrations` from the
migrations. The one file that cannot be recreated from git is the shared
`.env` — keep a copy off the host.

1. Ubuntu with Apache 2.4 on `mpm_event` (`proxy_fcgi`, `http2`, `mod_rewrite`,
   `mod_expires`, `mod_headers`, `mod_ssl`, plus `Protocols h2 http/1.1`), the
   PHP named in `.php-version` as `php<ver>-fpm` (`a2enconf php<ver>-fpm`) with
   `curl intl mbstring mysql xml`, MariaDB, git, certbot with the Apache plugin.
2. Lay out the release structure, all of it owned by `www-data` - and let
   `www-data` write `/var/www` itself, which it cannot by default: `pfg-sync`
   builds the `pfg-current` link there:

   ```
   chgrp www-data /var/www && chmod 775 /var/www
   git init --bare /var/www/pfg-objects.git
   git -C /var/www/pfg-objects.git remote add origin https://github.com/Ogeeon/proxyforgame.git
   mkdir -p /var/www/pfg-releases /var/www/pfg-shared
   sudo -u www-data git -C /var/www/pfg-objects.git fetch origin main
   ```

   Then, as `www-data`, build the first release at the tip (`git -C
   /var/www/pfg-objects.git worktree add --detach /var/www/pfg-releases/<sha>
   <sha>`), link its `.env` at the shared file (step 3), and point the two
   links at it — both with the atomic idiom:

   ```
   ln -s /var/www/pfg-releases/<sha> /var/www/pfg-current.tmp
   mv -T /var/www/pfg-current.tmp /var/www/pfg-current
   ln -s /var/www/pfg-releases/<sha>/www /var/www/proxyforgame-docroot.tmp
   mv -T /var/www/proxyforgame-docroot.tmp /var/www/proxyforgame-docroot
   ```
3. Restore `.env` into `/var/www/pfg-shared/.env` (mode 600, `www-data`).
   Create the database and its users
   (`DB_USER` for the app, `DB_DDL_USER` with DDL and DML — see *Database
   changes*), import `schema.sql`, then run `deploy/pfg-migrate` and
   `deploy/pfg-changelog-apply` from the first release.
4. Vhosts for `proxyforgame.net` and `proxyforgame.com` (with their `www.`
   aliases) on the document-root link — the `<Directory>` block names the link
   too, see *Traps* — and for `webhooks.proxyforgame.com` on
   `/var/www/webhooks-proxyforgame`, with the `SetEnv` above.
   The `proxyforgame.com` HTTPS vhost also serves the PfG Companion userscript,
   which is published by hand from its own repository
   (`Ogeeon/pfg-companion-script`, `npm run deploy`) and lives outside the
   releases, which are replaced and pruned wholesale. Installed copies poll
   `https://proxyforgame.com/companion/pfg-companion.meta.js` for updates, so
   the path must survive a rebuild — create `/var/www/pfg-companion` and add to
   that vhost:

   ```apache
   Alias /companion/ /var/www/pfg-companion/
   <Directory /var/www/pfg-companion>
       Options -Indexes
       AllowOverride None
       Require all granted
       Header set Cache-Control "no-cache"
   </Directory>
   ```

   Then run `npm run deploy` in that repository to put the files back.
5. Install `pfg-sync`, `pfg-notify` and `pfg-cron-run` into `/usr/local/bin/`
   and `webhook.php` into the webhooks root; write `/etc/pfg-sync.conf`
   (`REPO_DIR`, `RELEASES_DIR`, `CURRENT_LINK`, `DOCROOT_LINK`, `SHARED_ENV`,
   `KEEP_RELEASES`
   and the smoke keys, as the script's header documents), `/etc/pfg-cron.conf`
   (`STAMP_DIR=/var/lib/pfg/job-stamps`, readable by
   `www-data`) and `/etc/pfg-webhook.conf` (the secret is in the GitHub webhook
   settings — set a new one there if it is lost).
6. The MCP server, as in *The MCP server* above.
7. The `www-data` crontab: `uni.list.cron.php` and `get_population.php` under
   `pfg-cron-run`, both named through `/var/www/pfg-current/` (see above),
   and `*/5 * * * * /usr/local/bin/pfg-sync`. Run
   both jobs once by hand so the pickers are not empty until midnight.
8. Point DNS at the new address, then `certbot --apache` for every name.
   `bash deploy/watchdog.sh` going green is the definition of done.

## The MCP server

`mcp/server.js` serves the calculators to LLM clients over the Model Context
Protocol (`mcp/README.md`; why it is a Node process: ADR-0005). It is a
long-running process, unlike everything else the site runs, so three things
are different from the PHP side.

**It is started by systemd and reached through Apache.** The process listens on
loopback only; `apache-mcp.conf` proxies the one path `/mcp` to it from both
site vhosts. Apache appends the client's address to `X-Forwarded-For`, and the
server's per-address rate limit (120 a minute) reads it from there.

**A deploy restarts it.** The server loads the calculator scripts once, at
start, and keeps computing with them until it is restarted. `pfg-sync` runs as
`www-data` and cannot call `systemctl`, so after a deploy that passed its smoke
test it writes the commit to `MCP_RESTART_FILE` (`/etc/pfg-sync.conf`), and
`pfg-mcp-restart.path` restarts the service on that write. A deploy that is
flipped back writes nothing: the previous release is still on disk, and the
server already holds its code in memory. A failed write is logged as a warning,
never fails the deploy.

**The watchdog checks it.** It sends `initialize` to `/mcp` under each name. The
answer's `serverInfo.version` ends in the commit the server loaded
(`1.0.0+3f2c1ab09d4e`), and a commit that differs from the one health reports
means the restart never happened. A 404 — Apache not proxying the path — only
warns, until the repository variable `PFG_MCP_REQUIRED` is set to `1`; from then
on it fails like anything else.

### Setting it up

```
apt install nodejs                       # 20 or newer; `node --version`
install -m 644 /var/www/pfg-current/deploy/pfg-mcp.service \
               /var/www/pfg-current/deploy/pfg-mcp-restart.path \
               /var/www/pfg-current/deploy/pfg-mcp-restart.service /etc/systemd/system/
install -d -o www-data -g www-data /var/lib/pfg/mcp
systemctl daemon-reload
systemctl enable --now pfg-mcp pfg-mcp-restart.path
curl -s -X POST http://127.0.0.1:8787/mcp -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'             # {"jsonrpc":"2.0","id":1,"result":{}}

a2enmod proxy proxy_http
install -m 644 /var/www/pfg-current/deploy/apache-mcp.conf /etc/apache2/pfg-mcp.conf
# add `Include /etc/apache2/pfg-mcp.conf` to the :443 vhost of proxyforgame.net and of proxyforgame.com
apachectl configtest && systemctl reload apache2

echo 'MCP_RESTART_FILE=/var/lib/pfg/mcp/deployed' >> /etc/pfg-sync.conf
cp /var/www/pfg-current/deploy/pfg-sync /usr/local/bin/pfg-sync    # the copy that knows MCP_RESTART_FILE
```

Then check it from outside with `bash deploy/watchdog.sh` (an `ok   MCP …` line
under each name), and set `PFG_MCP_REQUIRED=1` under the repository's Actions
variables.

The units and `apache-mcp.conf` are installed copies, like `webhook.php`: a
change to them in the repository reaches the host only when it is reinstalled
(then `systemctl daemon-reload` or `systemctl reload apache2`). The Apache
snippet is copied rather than included from a release on purpose — a rollback
to a commit from before it existed would otherwise break Apache's next reload.

`journalctl -u pfg-mcp` has the server's log: the start line with its version,
and a stack for any tool that failed with an internal error. Stopping it
(`systemctl stop pfg-mcp`) takes `/mcp` down to a 503 and nothing else.

## Database changes

Schema changes are versioned SQL files in `db/migrations/`, applied by the
deploy: `pfg-sync` runs `deploy/pfg-migrate` from the new release, **before**
the flip that switches the site onto it, and records each file in
`schema_migrations`. A failure is fatal — the release is dropped and the mail
goes out, but the site never leaves the previous release, because the code
about to go live may need the schema. Full rules for writing one:
`db/migrations/README.md`.

**A migration lands seconds before the code that needs it, so it must be
expand-only and backward compatible with the code already deployed** — add
columns and tables, never drop or rename something the running code still uses.
Drop/rename is a separate migration a release later.

`pfg-migrate` connects with `DB_HOST`/`DB_NAME` from the release's `.env` and
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
with every release, and `pfg-sync` pipes it into the host's database through
`pfg-changelog-apply` after every successful deploy.

- **It runs whenever a deploy actually switches the site** — and when a `--sha` is
  re-asserted by the webhook or a rollback. Not on an idle green-mode reconcile,
  so the five-minute timer stays quiet when nothing changed. Every statement in
  `changelog.sql` is `insert … on duplicate key update`, so a database that
  already has the entry writes nothing and one that is behind catches up on its
  next sync.
- **A failure is not fatal.** The site code is already live when it runs; a
  failure means the sidebar rows lag one release, logged as `WARNING: changelog
  apply failed`, nothing more.
- **Credentials come from the release's `.env`** (`DB_*`), the same file the app
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
  vhosts name the link in both places, which is what lets the release layout
  flip that link without ever touching Apache.
- **`ln -sfn` is not an atomic swap.** It unlinks and then symlinks, and for
  the instant in between the link does not exist — through the document root
  that is a burst of errors. Every link the site serves through is swapped as
  `ln -s <target> <link>.tmp && mv -T <link>.tmp <link>`; `rename(2)` is
  atomic. `ln -sfn` remains fine for links nothing serves through yet, like
  the document root during a rebuild.
- **An indirecting symlink does not switch PHP code.** The first release
  layout pointed the document root at `pfg-current/www` and flipped only
  `pfg-current`; static files moved with the flip, but every PHP script kept
  running the old release for as long as opcache held the compiled code for
  the (unchanged) request path — `__DIR__` is folded in at compile time, so
  even `ajax.php?service=health` reported the previous commit while `curl`
  of a static file in the same tree served the new one. Found on 2026-10-26
  when a deploy went out and health never moved. The document root link now
  targets each release's own `www`, so every deploy is a set of paths nothing
  has cached; `systemctl reload php8.5-fpm` is the escape hatch if a stale
  entry ever needs clearing by hand.
- **A release worktree's `.git` is a file, not a directory** — `gitdir:
  <path>` into the bare store. Anything that walks `.git/` by hand has to
  follow the pointer; `ajax.php?service=health` does (that is what its
  `healthDeployedCommit` fix is for), and plain git needs nothing, it
  understands worktrees natively.
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
  (tip of main, then its ancestors), and the release layout took the rest away
  — there is no reset to overwrite anything, and `.env` is one shared file
  no release owns.
