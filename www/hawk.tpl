<?php
// Browser error tracking (hawk.so). Included first thing in every page's
// <head>, ahead of any other script, so an error thrown while the page is
// still loading is caught as well.
//
// Off unless the host's .env carries HAWK_TOKEN: production and the standby
// set it, local development and CI do not, and so report nothing.
require_once __DIR__ . '/env.inc.php';
require_once __DIR__ . '/api/health.inc.php';

$hawkToken = getenv('HAWK_TOKEN');
if (is_string($hawkToken) && $hawkToken !== ''):
  $hawkSettings = array(
    'token'   => $hawkToken,
    // The deployed commit, so an error can be pinned to the push that brought it.
    'release' => healthDeployedCommit(dirname(__DIR__)),
    'context' => array(
      'host' => $_SERVER['HTTP_HOST'] ?? '',
      'lang' => $lang ?? '',
    ),
  );
?>
  <script src="https://cdn.jsdelivr.net/npm/@hawk.so/browser@3.4.0/dist/hawk.umd.js" integrity="sha384-rAp85pgtKlEx23tVr8XlDEVJi8+kW3xBvImezrfXdJ4xaKECKMoePg/NabROSa3z" crossorigin="anonymous"></script>
  <script>
    if (typeof HawkCatcher === 'function') {
      const hawkSettings = <?= json_encode($hawkSettings, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>;
      // A user given up front keeps Hawk from minting its own anonymous id
      // and persisting it in localStorage. A fresh one per page load leaves
      // nothing behind in the browser, so tracking needs no cookie consent.
      hawkSettings.user = {
        id: Array.from(crypto.getRandomValues(new Uint8Array(16)), function (b) { return b.toString(16).padStart(2, '0'); }).join('')
      };
      // Only errors our own code is involved in. Browser extensions, injected
      // translators and third-party counters fail on this page too, and none
      // of that is ours to fix.
      hawkSettings.beforeSend = function (event) {
        const frames = event.backtrace;
        if (!frames || frames.length === 0) {
          // All a browser reveals about an error in a cross-origin script.
          return event.title.indexOf('Script error') === 0 ? false : event;
        }
        const ours = location.origin + '/';
        return frames.some(function (frame) { return (frame.file || '').indexOf(ours) === 0; }) ? event : false;
      };
      window.hawk = new HawkCatcher(hawkSettings);
    }
  </script>
<?php endif; ?>
