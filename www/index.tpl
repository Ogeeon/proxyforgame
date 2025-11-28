<!DOCTYPE html>
<head>
	<meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
	<meta http-equiv="Cache-Control" content="no-cache" />
	<title><?= $l['title'] ?></title>
	<meta name="description" content="<?= $l['title'] ?>"/>
	<meta name="keywords" content="<?= $l['keywords'] ?>"/>
	<link rel="shortcut icon" href="/favicon.ico" type="image/x-icon"/>
	<link rel="icon" href="/favicon.ico" type="image/x-icon"/>

	<link id="light-theme" type="text/css" href="/css/redmond/jquery.ui.all.css" rel="stylesheet"/>
	<link id="dark-theme" type="text/css" href="/css/dark-hive/jquery.ui.all.css" rel="stylesheet" disabled="disabled"/>
	<link type="text/css" href="/css/common.css" rel="stylesheet" />
	<link type="text/css" href="/css/langs.css" rel="stylesheet" />
<?php if ( $_SERVER['SERVER_NAME'] == 'proxyforgame.com'): ?>
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.5.1/jquery.min.js"></script>
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jqueryui/1.8.11/jquery-ui.min.js"></script>
<?php elseif ( $_SERVER['SERVER_NAME'] == 'pfg.wmp'): ?>
	<script type="text/javascript" src="/js/jquery.min.js"></script>
	<script type="text/javascript" src="/js/jquery-ui.min.js"></script>
<?php else: ?>
	<script type="text/javascript" src="/js/jquery-1.5.1.min.js"></script>
	<script type="text/javascript" src="/js/jquery-ui-1.8.11.min.js"></script>
<?php endif; ?>
	<script type="text/javascript" src="/js/jquery.cookie.js"></script>
<?php require_once('social.head.tpl'); ?>
<?php require_once('cookies.tpl'); ?>	
	<script type="text/javascript" src="/js/utils.js"></script>
	<script type="text/javascript">
		$(document).ready(function() {
			var theme = $.cookie("theme");
			toggleLight(theme == 'light');
			$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked);});
	  });
	</script>	
		
</head>
<body class="ui-widget">

<table id="vtable" cellspacing="2" cellpadding="0" border="0"><tr>
<td id="vtablesb"><?php require_once('sidebar.tpl'); ?></td>
<td id="vtablec">
<?php require_once('topbar.tpl'); ?>

<div id="startpage">
<?= str_replace('ProxyForGame', '<strong>ProxyForGame</strong>', $l['title']) ?>
</div>

</td>
</tr></table>
<?php
	require_once('analitics.tpl');
?>

</body>
</html>
