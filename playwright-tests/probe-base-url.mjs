// Prints the first local server that answers the health endpoint, for
// playwright.config.js to use when PFG_BASE_URL is not set. WAMP comes first:
// Apache serves requests in parallel, while `php -S` on :8000 is single-threaded
// and flakes under a full-width worker pool. Exits 1 when nothing answers.

// Plain http on purpose: both are local development servers with no certificate.
const CANDIDATES = ['http://pfg.wmp', 'http://localhost:8000']; // NOSONAR(S5332)

// Asked all at once and read back in the order above, so a dead first
// candidate costs one timeout rather than one per candidate.
const answers = await Promise.all(CANDIDATES.map(async (url) => {
  try {
    const res = await fetch(`${url}/ajax.php?service=health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    // Not running, or the host name does not resolve.
    return false;
  }
}));
const found = CANDIDATES.find((_url, i) => answers[i]);
if (found) {
  process.stdout.write(found);
  process.exit(0);
}
process.exit(1);
