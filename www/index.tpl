<!DOCTYPE html>
<html lang="<?= getLangAttr() ?>">
<head>
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
  <?php require_once('hawk.tpl'); ?>
  <title><?= $l['title'] ?></title>
  <meta name="description" content="<?= $l['title'] ?>">
  <meta name="keywords" content="<?= $l['keywords'] ?>">
  <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
<?php
  // www/ on disk, for the filemtime() cache-busting stamps below.
  $pfgPath = __DIR__;
?>
  <!-- Bootstrap 5 and Bootstrap Icons (CSS, icon font, JS bundle) -->
  <?php require_once 'vendor_bs.tpl'; ?>

  <!-- Custom styles -->
  <link type="text/css" href="/css/langs_bs.css?v=<?php echo filemtime($pfgPath.'/css/langs_bs.css'); ?>" rel="stylesheet">
  <link type="text/css" href="/css/common_bs.css?v=<?php echo filemtime($pfgPath.'/css/common_bs.css'); ?>" rel="stylesheet">

  <!-- Utility libraries -->
  <script src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>" defer></script>
  <script src="/js/api-client.js?v=<?php echo filemtime($pfgPath.'/js/api-client.js'); ?>" defer></script>
<?php require_once('cookies.tpl'); ?>
</head>

<body>

<h1 class="visually-hidden"><?= $l['title'] ?></h1>

<div class="container-fluid">
  <div class="row">
    <div class="col-md-2"><?php require_once('sidebar_bs.tpl'); ?></div>
    <div class="col-md-10">
    <?php require_once('topbar_bs.tpl'); ?>

<div id="startpage">
  <?= str_replace('ProxyForGame', '<strong>ProxyForGame</strong>', $l['title']) ?>
</div>

    </div> <!-- End col-md-10 -->
  </div> <!-- End row -->
</div> <!-- End container-fluid -->
<?php
  require_once('analitics.tpl');
?>

<script type="module">
  // Theme toggle (no calculator orchestration on the start page)
  document.addEventListener('DOMContentLoaded', function() {
    let theme = { value: 'light', validate: function(key, val) { return val; } };
    loadFromCookie('theme', theme);
    toggleLightBS(theme.value === 'light');
    const cbLight = document.getElementById('cb-light-theme');
    if (cbLight) cbLight.addEventListener('click', function() { toggleLightBS(this.checked); });
  });
</script>

</body>
</html>
