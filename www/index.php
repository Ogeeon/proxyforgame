<?php

require_once('langs.php');
$lang = get_lang();
$currUrl = '/';
require_once('Intl.php');
$l = Intl::getTranslations($lang, 'index');

require_once('index.tpl');
?>
