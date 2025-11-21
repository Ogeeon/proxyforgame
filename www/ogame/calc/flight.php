<?php

require_once('../../langs.php');
$lang = get_lang();
$currUrl = '/ogame/calc/flight.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, 'flight');

require_once('flight.tpl');

?>
