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
  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">
  <!-- The icon font is only discovered once the stylesheet above has loaded; preloading
       starts it in parallel. The URL must match the one in that stylesheet exactly. -->
  <link rel="preload" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/fonts/bootstrap-icons.woff2?1bb88866b4085542c8ed5fb61b9393dd" as="font" type="font/woff2" integrity="sha384-KoRugHSRrvj5dWFDXACL3VSSqDjno21U52laTdBeNExt4L5B/6BQG01Q71ZvFzP4" crossorigin="anonymous">

  <!-- Custom styles -->
  <link type="text/css" href="/css/langs_bs.css?v=<?php echo filemtime($pfgPath.'/css/langs_bs.css'); ?>" rel="stylesheet">
  <link type="text/css" href="/css/common_bs.css?v=<?php echo filemtime($pfgPath.'/css/common_bs.css'); ?>" rel="stylesheet">

  <!-- Bootstrap 5 JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js" defer></script>

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
