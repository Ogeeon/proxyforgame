# The `@claude` workflow

`.github/workflows/claude.yml` runs Claude Code on a runner when the owner or a collaborator
writes `@claude` in an issue, an issue comment, a review or a review comment. Claude commits on
a `claude/<entity>-<number>-<timestamp>` branch, pushes it and opens a pull request.

Two things it needs that the upstream template does not give it, and one safety net.

## The GitHub App (one-time, manual)

The job could push with the built-in `GITHUB_TOKEN`, but GitHub deliberately does not fire
workflows for pushes and pull requests made with it — `playwright.yml` would never run on
Claude's PR, so nothing would ever verify the work in the place where it matters. An App
installation token has no such restriction.

Until `CLAUDE_APP_ID` and `CLAUDE_APP_PRIVATE_KEY` exist, the minting step fails,
`continue-on-error` swallows it and the run falls back to `GITHUB_TOKEN`. Claude still works and
still pushes; only the automatic CI trigger is missing.

1. <https://github.com/settings/apps/new> — name it something like `pfg-claude-ci`, homepage URL
   can be the repository. Under **Webhook**, untick **Active**; the App is only ever used to mint
   tokens and never receives events.
2. **Repository permissions:**

   | Permission    | Access         | Why |
   | ------------- | -------------- | --- |
   | Contents      | Read and write | Push the branch |
   | Pull requests | Read and write | Open the PR |
   | Issues        | Read and write | Post the progress comment |
   | Actions       | Read-only      | `additional_permissions: actions: read` — reading CI results on a PR |

3. **Where can this GitHub App be installed?** → *Only on this account*. Create it, note the
   numeric **App ID**, then **Generate a private key** and keep the `.pem` that downloads.
4. Install the App on `Ogeeon/proxyforgame` — *Only select repositories*.
5. Store both halves as repository secrets:

   ```bash
   gh secret set CLAUDE_APP_ID --body '<the numeric App ID>'
   gh secret set CLAUDE_APP_PRIVATE_KEY < path/to/key.pem
   ```

   The private key must go in whole, `-----BEGIN RSA PRIVATE KEY-----` and
   `-----END RSA PRIVATE KEY-----` lines included. Delete the local `.pem` afterwards.

To confirm it took: comment `@claude` on any issue and check that the run's push lands a branch on
the remote **and** that `playwright.yml` starts by itself on the resulting pull request. If the
branch appears but CI stays idle, the App token was not used — look at the "Mint a GitHub App
token" step, which is allowed to fail quietly.

## What Claude can run on the runner

Without an explicit allowlist every `Bash` call waits for an approval that cannot arrive in a
non-interactive run. That is what happened on issue #5: Claude wrote the whole change, could not
execute a single test, and said so only at the end.

The job now installs Node 24 and runs `npm ci`, and `claude_args` allows `make`, `npm`, `npx`,
`node`, `git` and `gh`. That covers the non-browser half of `make check`:

```
make changelog-validate i18n-validate lint typecheck tsconfigs-check test-unit
```

`make test-e2e` and `make html-validate` are deliberately out of scope — they need PHP, MySQL,
Playwright browsers and a JRE, roughly seven more minutes of setup to duplicate what
`playwright.yml` already does on the pull request. **A `@claude` run is therefore not a green
`make check`.** Treat its PR like any other: the browser suite has to pass there before merge.

## Recovering work when the push fails anyway

The **Preserve unpushed work** step runs on every outcome, including a failed or cancelled job. It
bundles every local commit that is not on `origin` and uploads it as the `claude-unpushed-work`
artifact, kept 30 days. If the bundle would be empty — the normal case once pushing works —
`git bundle` exits non-zero and nothing is uploaded.

To get the commits back, download the artifact from the run's summary page and:

```bash
git bundle verify claude-work.bundle
git fetch claude-work.bundle 'refs/heads/*:refs/heads/recovered/*'
```

This exists because commit `d2a5837` on issue #5 was lost exactly this way: it was real, complete
and clean, and it lived only inside a runner that was about to be destroyed.
