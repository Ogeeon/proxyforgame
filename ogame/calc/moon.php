<?php

require_once('../../langs.php');
$lang = get_lang();
$currUrl = '/ogame/calc/moon.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, 'moon');

require_once('moon.tpl');

?>
