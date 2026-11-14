// Commit messages follow Conventional Commits (see the `commit` skill). Checked
// by `make commitlint` over a range of commits; CI runs it over the commits of
// each push and pull request. Lines with URLs are exempt from the 100-column
// body limit, which is what keeps Dependabot's messages passing.
export default {
  extends: ['@commitlint/config-conventional'],
};
