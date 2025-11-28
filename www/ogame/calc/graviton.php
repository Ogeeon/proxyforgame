<?php

require_once('../../langs.php');
$lang = get_lang();
$currUrl = '/ogame/calc/graviton.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, 'graviton');

require_once('graviton.tpl');

?>
