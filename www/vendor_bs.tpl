<?php
  // Bootstrap 5 and Bootstrap Icons, served from www/vendor/ - committed copies
  // of the versions package.json pins (`make vendor`, scripts/vendor-assets.js).
  // Every page includes this at the top of its stylesheets, so Bootstrap's CSS
  // comes before the site's own and its deferred bundle runs before the page
  // scripts.
  require_once __DIR__ . '/vendor/vendor.inc.php';
  $vendorDir = __DIR__ . '/vendor';
?>
  <link href="/vendor/bootstrap/bootstrap.min.css?v=<?php echo filemtime($vendorDir.'/bootstrap/bootstrap.min.css'); ?>" rel="stylesheet">
  <link href="/vendor/bootstrap-icons/bootstrap-icons.min.css?v=<?php echo filemtime($vendorDir.'/bootstrap-icons/bootstrap-icons.min.css'); ?>" rel="stylesheet">
  <!-- The icon font is only discovered once the stylesheet above has loaded; preloading
       starts it in parallel. The URL must match the one in that stylesheet exactly. -->
  <link rel="preload" href="/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2?<?= VENDOR_ICONS_FONT_HASH ?>" as="font" type="font/woff2" crossorigin>
  <script src="/vendor/bootstrap/bootstrap.bundle.min.js?v=<?php echo filemtime($vendorDir.'/bootstrap/bootstrap.bundle.min.js'); ?>" defer></script>
