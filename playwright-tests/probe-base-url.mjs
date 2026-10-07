// Prints the first local server that answers the health endpoint, for
// playwright.config.js to use when PFG_BASE_URL is not set. WAMP comes first:
// Apache serves requests in parallel, while `php -S` on :8000 is single-threaded
// and flakes under a full-width worker pool. Exits 1 when nothing answers.

const CANDIDATES = ['http://pfg.wmp', 'http://localhost:8000'];

for (const url of CANDIDATES) {
  try {
    const res = await fetch(`${url}/ajax.php?service=health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      process.stdout.write(url);
      process.exit(0);
    }
  } catch {
    // Not running, or the host name does not resolve - try the next one.
  }
}
process.exit(1);
