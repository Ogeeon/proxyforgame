<?php

require_once '../../langs.php';
require_once 'universes.inc.php';
$lang = getLang();
$currUrl = '/ogame/calc/trade.php';

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'trade');

$countries = loadUniverseCountries($lang);
$universes = loadUniverses($countries);

require_once 'trade.tpl';
