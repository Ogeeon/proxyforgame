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
                                    → smoke test → mail on failure
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
| `cutover-prod.sh` | production | One-time move from the old Bitbucket checkout. `--dry-run` stops before anything live is touched. |
| `cutover-standby.sh` | standby | The same, plus introducing a document-root symlink the host did not have. |
| `rollback-prod.sh` | production | Undoes the cutover. Not the everyday rollback — see below. |

`pfg-sync` and `pfg-notify` are installed **outside** the checkout
(`$DATA/bin/` on production, `/usr/local/bin/` on the standby). `pfg-sync`
resets the tree it would otherwise be running from, and bash reads a script as
it executes it — a self-update mid-run would make it read the second half of a
different file. The cost is that they do not update themselves; `pfg-sync` says
so when its installed copy has drifted from the one in the checkout.

`webhook.php` sits outside the checkout for a different reason — it belongs to
another vhost's document root — and **nothing warns when it drifts**. A deploy
updates the copy in `deploy/` and leaves the running one untouched, so a change
to the receiver has to be reinstalled by hand:

```
install -m 644 <checkout>/deploy/webhook.php <data>/www/webhooks.proxyforgame.com/
```

## The two hosts

| | production | standby |
|---|---|---|
| address | `88.218.248.47` | `89.124.110.192` |
| in DNS | yes — `proxyforgame.com` | no |
| panel | ISPmanager, **no root** (uid 1012) | plain Ubuntu, root |
| checkout | `/var/www/www-proxyforgame/data/deploy/proxyforgame.com-gh` | `/var/www/proxyforgame-gh` |
| document root | `~/www/proxyforgame.com` → `<checkout>/www` | `/var/www/proxyforgame-docroot` → `<checkout>/www` |
| PHP | 8.2 (`/opt/php82/bin/php`) | 8.5 (`/usr/bin/php`) — see issue #13 |
| cron owner | `www-proxyforgame` | `www-data` |
| deploy log | `<data>/logs/deploy.log` | `/var/log/pfg-cron.log` |
| trigger | webhook, plus an hourly reconcile | five-minute timer |

Both are Apache 2.4 with mod_php and a MariaDB of their own. No Docker. Opcache
is on with `validate_timestamps` and `revalidate_freq=2`, so a deploy needs no
cache flush — new files are picked up within two seconds.

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

**A rollback moves production only.** The standby follows the newest *green*
commit of `main` on its timer, so within five minutes it is back on the tip
while production sits on the older commit. That is the intended asymmetry —
production is the host under repair — but the two are genuinely running
different code until `main` moves again.

**Last resort — at a shell:** `pfg-sync --sha <sha>`.

## What `pfg-sync` will not do

- **It never runs `git pull`.** A pull can merge, and merges are how the old
  Bitbucket checkout accumulated 26 commits that existed nowhere else. A
  `reset --hard` makes the checkout a mirror that cannot drift.
- **`git clean -fd` must never gain `-x`.** The gitignored `.env` sits in the
  checkout root and is the one file there that cannot be recreated from git.
- **It refuses anything that is not a hex commit id.** A SHA arrives from the
  public internet and ends up on a command line, however well signed the
  delivery was.

## After every deploy

`pfg-sync` fetches five URLs and fails loudly if any of them is wrong:

- `/`, `/ru/`, `/ogame/calc/flight.php`, `/ogame/calc/costs.php`
- `ajax.php?service=populatedSystems&country=ru&universe=268`

`/ru/` is in the list because it is the only one that exercises `.htaccess` —
if `AllowOverride` ever stops applying, every other page still returns 200 while
the language routing is silently gone. The `ajax.php` call is there because a
static page cannot show that `.env` survived or that MySQL is answering.

External monitoring covers what a deploy-time check cannot: a host that falls
over between deploys. See issue tracker for the UptimeRobot and Healthchecks.io
setup.

## Database changes

The pipeline does not touch the database, and there is no migration mechanism
yet (issue #12). Until there is:

**Apply the schema change first, and make it backward compatible with the code
already deployed.** With deploys landing minutes after a push, there is no
longer a comfortable gap in which to catch up.

Production's app user has ALTER through ISPmanager, so PDO is enough there. The
standby's `pfg_app` deliberately does not — use the root `mysql` client over its
unix socket.

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
- **The old deploy checkout carried files that were in no repository** —
  `api.php`, `funct.php`, `lftech.*`, `dev_flight.*`. All were dead: nothing
  referenced them and ten days of access logs showed zero hits. `cutover-prod.sh`
  tars them before they disappear.
