Use the sonarqube mcp server to find and fix issues, one at a time, choosing scope from `$0`:

- `$0` empty or `all`/`project`: query findings across the whole project (no path filter), in
  whatever order SonarQube returns them (usually severity). Resolve the test scope per finding from
  the file it's in (see resolution rule below) — don't run a separate pass per calculator.
- `$0` is a known calculator name (`flight`, `costs`, `lfcosts`, `graviton`, `moon`, `production`,
  `queue`, `terraformer`, `trade`, `expeditions`): restrict findings to that calculator's files and
  fix the test scope to it.
- `$0` is a file path (contains `/` or an extension): restrict findings to that one file; resolve
  its test scope with the same rule as the whole-project mode.

If a file has no SonarQube index yet, fall back to `analyze_code_snippet` on its contents.

Test-scope resolution for a given file: **see `docs/test-scope.md`** — the file-set table and the
shared-file list live there, and that is the copy to trust.

Fix one finding at a time, but **batch the test run**, not the fix: don't re-run the full suite
per finding if several findings share the same test scope. Group them —

- **Same file, same scope**: apply all fixes for that file in one editing pass, run the resolved
  test scope once, then commit (one commit for the whole file, or several small commits made back
  to back with no test run in between — they were already verified together as a group). This
  matters most for shared files, since their test scope is the full `make test` suite: that's the
  expensive step, so don't pay it once per finding when it was going to be the same run anyway.
- **Same mechanical rule across many files in the same scope** (e.g. `var`→`const`, missing
  `node:` prefix, `NULL`→`null`): pull all of that rule's findings within the scope via
  `search_sonar_issues_in_projects` filtered by rule key, apply the transform everywhere at once,
  then run the scope's test(s) a single time for the whole batch.
- If a rule's guidance (`show_rule`) has already been fetched once this session, don't re-fetch it
  for a later finding citing the same rule.

Run the batch's test scope after applying its fixes. If it passes, commit (see below). If it
fails, bisect within the batch — revert fixes one at a time (`git checkout -- <file>`) and re-run
the narrowest affected scope until the broken one is isolated — rather than discarding the whole
batch; keep the ones that were fine.

Commit with a message following the repo's Conventional Commits convention (`fix(<scope>):
<subject>`, scope = the calculator name or the closest area for shared files). Never leave an
unverified fix in the working copy — every commit must follow a passing run of its resolved test
scope, batched or not.
