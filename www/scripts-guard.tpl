<?php // Inline on purpose: it must run even when every deferred script on the
      // page has failed or been blocked - that is exactly when it is needed.
      // Requires $l with the common section loaded.
?>
<script>
(function() {
  var shown = false;
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
})();
</script>
