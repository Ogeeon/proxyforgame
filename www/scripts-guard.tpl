<?php // Inline on purpose: it must run even when every deferred script on the
      // page has failed or been blocked - that is exactly when it is needed.
      // Included in <head> right after hawk.tpl, ahead of every script request:
      // a failed request fires its error event once, and only a listener that
      // already exists hears it.
      // Requires $l with the common section loaded.
?>
<script>
(function() {
  var shown = false;
  // Same-origin scripts whose request failed. hawk.tpl reads it to drop the
  // errors that failure causes further down the page.
  window.pfgFailedScripts = [];
  // Called by the guard in each page's inline module: a deferred script that
  // never ran means its globals are missing, and the ReferenceError the module
  // would throw is pure Hawk noise ("X is not defined", one group per symbol).
  // Show the visitor one banner instead, and let the module stop there.
  window.pfgScriptsFailed = function() {
    if (shown) return;
    shown = true;
    var show = function() {
      var el = document.createElement('div');
      el.id = 'pfg-scripts-failed';
      el.setAttribute('role', 'alert');
      el.className = 'alert alert-danger text-center mb-0 rounded-0';
      el.textContent = <?= json_encode($l['scripts-failed-to-load'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
      document.body.appendChild(el);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', show);
    } else {
      show();
    }
  };
  // A failed script request raises no error of its own in the page - what shows
  // up is the ReferenceError of every script that needed it, one Hawk group per
  // symbol, with the missing file nowhere in them. Hear the request fail (the
  // event does not bubble, hence the capture phase) and report that instead.
  // Only our own scripts: an ad blocker refusing a counter is not a broken page.
  window.addEventListener('error', function(e) {
    var el = e.target;
    if (!el || el.tagName !== 'SCRIPT' || !el.src || el.src.indexOf(location.origin + '/') !== 0) return;
    var path = el.src.slice(location.origin.length).split('?')[0];
    window.pfgFailedScripts.push(path);
    window.pfgScriptsFailed();
    // The path alone, not the ?v= stamp, so one file is one Hawk group.
    var error = new Error('Script failed to load: ' + path);
    if (window.hawk) window.hawk.captureError(error);
    else if (window.hawkEarlyErrors) window.hawkEarlyErrors.push(error);
  }, true);
})();
</script>
