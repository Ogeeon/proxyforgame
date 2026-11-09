<!DOCTYPE html>
<html lang="<?= getLangAttr() ?>">
<head>
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
  <?php require_once 'hawk.tpl'; ?>
  <?php require_once __DIR__ . '/scripts-guard.tpl'; ?>
  <title><?= $l['title'] ?></title>
  <meta name="description" content="<?= $l['description'] ?>">
  <meta name="keywords" content="<?= $l['keywords'] ?>">
  <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
<?php
  // www/ on disk, for the content-hash cache-busting stamps below.
  $pfgPath = __DIR__;
?>
  <!-- Bootstrap 5 and Bootstrap Icons (CSS, icon font, JS bundle) -->
  <?php require_once 'vendor.tpl'; ?>

  <!-- Custom styles -->
  <link type="text/css" href="/css/langs.css?v=<?php echo assetVersion($pfgPath, '/css/langs.css'); ?>" rel="stylesheet">
  <link type="text/css" href="/css/common.css?v=<?php echo assetVersion($pfgPath, '/css/common.css'); ?>" rel="stylesheet">

  <!-- Utility libraries -->
  <script src="/js/utils.js?v=<?php echo assetVersion($pfgPath, '/js/utils.js'); ?>" defer></script>
  <script src="/js/api-client.js?v=<?php echo assetVersion($pfgPath, '/js/api-client.js'); ?>" defer></script>
<?php require_once 'cookies.tpl'; ?>
</head>

<body>

<div class="container-fluid">
  <div class="row">
    <div class="col-md-2"><?php require_once 'sidebar.tpl'; ?></div>
    <div class="col-md-10">
    <?php require_once 'topbar.tpl'; ?>

<main id="assistants-page" class="p-3">
  <h1 class="h3 text-primary-emphasis"><?= $l['title'] ?></h1>
  <p><?= $l['intro'] ?></p>

  <h2 class="h5 mt-4"><?= $l['address-header'] ?></h2>
  <div class="input-group" id="mcp-address-group">
    <input type="text" class="form-control" id="mcp-address" value="<?= $mcpUrl ?>" readonly aria-label="<?= $l['address-header'] ?>">
    <?php // On a phone the button shows only its icon, so that the address keeps the room. ?>
    <button type="button" class="btn btn-primary" id="mcp-address-copy" aria-label="<?= htmlspecialchars($l['copy']) ?>" data-copied-text="<?= htmlspecialchars($l['copied']) ?>">
      <i class="bi bi-clipboard" aria-hidden="true"></i> <span class="d-none d-sm-inline"><?= $l['copy'] ?></span>
    </button>
  </div>
  <div class="form-text"><?= $l['address-hint'] ?></div>

  <h2 class="h5 mt-4"><?= $l['connect-header'] ?></h2>
  <ul>
    <li><?= $l['connect-chatgpt'] ?></li>
    <li><?= $l['connect-claude'] ?></li>
    <li><?= $l['connect-other'] ?></li>
  </ul>

  <h2 class="h5 mt-4"><?= $l['examples-header'] ?></h2>
  <ul class="assistants-examples">
    <?php foreach (array('example-1', 'example-2', 'example-3', 'example-4') as $key): ?>
    <li><q><?= $l[$key] ?></q></li>
    <?php endforeach; ?>
  </ul>

  <h2 class="h5 mt-4"><?= $l['tools-header'] ?></h2>
  <ul>
    <?php foreach (PFG_CALCULATORS as $calc): ?>
    <li><a href="/<?= $lang ?>/<?= $calc ?>"><?= $menu[$calc . '-title'] ?></a></li>
    <?php endforeach; ?>
    <li><?= $l['tools-import'] ?></li>
  </ul>

  <h2 class="h5 mt-4"><?= $l['privacy-header'] ?></h2>
  <p><?= $l['privacy'] ?></p>

  <p class="mt-4 small">
    <i class="bi bi-github" aria-hidden="true"></i>
    <a href="https://github.com/Ogeeon/proxyforgame/tree/main/mcp" target="_blank" rel="noopener noreferrer"><?= $l['developers'] ?></a>
  </p>
</main>

    </div> <!-- End col-md-10 -->
  </div> <!-- End row -->
</div> <!-- End container-fluid -->
<?php
  require_once 'analitics.tpl';
?>

<script type="module">
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof loadFromCookie !== 'function' || typeof toggleLightBS !== 'function') {
      pfgScriptsFailed();
      return;
    }
    // Theme toggle (no calculator orchestration on this page)
    let theme = { value: 'light', validate: function(key, val) { return val; } };
    loadFromCookie('theme', theme);
    toggleLightBS(theme.value === 'light');
    const cbLight = document.getElementById('cb-light-theme');
    if (cbLight) cbLight.addEventListener('click', function() { toggleLightBS(this.checked); });

    // Copy the server address. Where the clipboard is unavailable (an insecure
    // origin, a refused permission) the address is selected instead, ready for
    // the player to copy by hand.
    const address = document.getElementById('mcp-address');
    const copy = document.getElementById('mcp-address-copy');
    if (!address || !copy) return;
    const label = copy.querySelector('span');
    const icon = copy.querySelector('i');
    const original = label ? label.textContent : '';
    const showCopied = function(copied) {
      if (label) label.textContent = copied ? (copy.dataset.copiedText || original) : original;
      if (icon) icon.className = copied ? 'bi bi-clipboard-check' : 'bi bi-clipboard';
    };
    copy.addEventListener('click', async function() {
      try {
        await navigator.clipboard.writeText(address.value);
        showCopied(true);
        setTimeout(function() { showCopied(false); }, 2000);
      } catch {
        address.select();
      }
    });
  });
</script>

</body>
</html>
