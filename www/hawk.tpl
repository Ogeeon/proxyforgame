<?php
// Browser error tracking (hawk.so). Included first thing in every page's
// <head>, ahead of any other script.
//
// The catcher loads async, so a CDN round trip never holds up rendering. Until
// it arrives, a pair of listeners keeps the errors thrown meanwhile and hands
// them over once it is up, so an error raised while the page is still loading
// is reported as well.
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
  <script>
    window.hawkEarlyErrors = [];
    window.addEventListener('error', function (e) { if (window.hawkEarlyErrors) window.hawkEarlyErrors.push(e.error || e.message); });
    window.addEventListener('unhandledrejection', function (e) { if (window.hawkEarlyErrors) window.hawkEarlyErrors.push(e.reason); });
    function initHawk() {
      const early = window.hawkEarlyErrors || [];
      window.hawkEarlyErrors = null;
      if (typeof HawkCatcher !== 'function') {
        return;
      }
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
        // Once a script of ours failed to load (scripts-guard.tpl), whatever
        // else the page throws is that failure's echo - a ReferenceError per
        // symbol it would have defined. The failure itself is reported once, by
        // name; its echoes only bury it.
        if (window.pfgFailedScripts && window.pfgFailedScripts.length > 0
            && event.title.indexOf('Script failed to load:') !== 0) {
          return false;
        }
        const frames = event.backtrace;
        if (!frames || frames.length === 0) {
          // All a browser reveals about an error in a cross-origin script.
          return event.title.indexOf('Script error') === 0 ? false : event;
        }
        const ours = location.origin + '/';
        return frames.some(function (frame) { return (frame.file || '').indexOf(ours) === 0; }) ? event : false;
      };
      window.hawk = new HawkCatcher(hawkSettings);
      early.forEach(function (error) {
        if (error instanceof Error || (typeof error === 'string' && error !== '')) {
          window.hawk.captureError(error);
        }
      });
      reportSlowInteractions();
    }

    // Field INP attribution. CrUX says the 75th percentile is slow but not
    // which control causes it; this reports the slowest interaction of a page
    // visit when it is over 200 ms ("needs improvement"), grouped in Hawk by
    // the element that was hit. Only a selector (tag, id, two classes) and the
    // timing phases leave the page, never a typed value.
    function reportSlowInteractions() {
      const THRESHOLD_MS = 200;
      const MAX_REPORTS = 3;
      const FLUSH_DELAY_MS = 3000;
      try {
        if (typeof PerformanceObserver !== 'function'
            || !PerformanceObserver.supportedEntryTypes
            || PerformanceObserver.supportedEntryTypes.indexOf('event') === -1) {
          return;
        }
        const worstByInteraction = new Map();
        let reported = 0;
        let lastReportedMs = 0;
        let timer = null;

        const describe = function (node) {
          if (!node?.tagName) {
            return '(unknown)';
          }
          let text = node.tagName.toLowerCase();
          if (node.id) {
            return text + '#' + node.id;
          }
          const classes = (typeof node.className === 'string' ? node.className : '').split(/\s+/).filter(Boolean);
          if (classes.length > 0) {
            text += '.' + classes.slice(0, 2).join('.');
          }
          return text;
        };

        const flush = function () {
          timer = null;
          let worst = null;
          worstByInteraction.forEach(function (info) {
            if (worst === null || info.duration > worst.duration) {
              worst = info;
            }
          });
          if (worst === null || worst.duration <= lastReportedMs || reported >= MAX_REPORTS || !window.hawk) {
            return;
          }
          reported += 1;
          lastReportedMs = worst.duration;
          window.hawk.send('INP slow: ' + worst.target + ' (' + worst.type + ')', {
            inpMs: worst.duration,
            inputDelayMs: worst.inputDelay,
            processingMs: worst.processing,
            presentationDelayMs: worst.presentation,
            page: location.pathname,
            interactions: worstByInteraction.size,
          });
        };

        new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (entry) {
            if (!entry.interactionId || entry.duration < THRESHOLD_MS) {
              return;
            }
            const known = worstByInteraction.get(entry.interactionId);
            if (known && known.duration >= entry.duration) {
              return;
            }
            worstByInteraction.set(entry.interactionId, {
              duration: Math.round(entry.duration),
              inputDelay: Math.round(entry.processingStart - entry.startTime),
              processing: Math.round(entry.processingEnd - entry.processingStart),
              presentation: Math.round(entry.startTime + entry.duration - entry.processingEnd),
              type: entry.name,
              target: describe(entry.target),
            });
            if (timer === null) {
              timer = setTimeout(flush, FLUSH_DELAY_MS);
            }
          });
        }).observe({ type: 'event', buffered: true, durationThreshold: THRESHOLD_MS });

        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'hidden') {
            flush();
          }
        });
      } catch (e) {
        // Measuring must never break the page.
      }
    }
  </script>
  <script async src="https://cdn.jsdelivr.net/npm/@hawk.so/browser@3.4.0/dist/hawk.umd.js" integrity="sha384-rAp85pgtKlEx23tVr8XlDEVJi8+kW3xBvImezrfXdJ4xaKECKMoePg/NabROSa3z" crossorigin="anonymous" onload="initHawk()"></script>
<?php endif; ?>
