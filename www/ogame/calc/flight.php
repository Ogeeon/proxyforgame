<?php

require_once '../../langs.php';
require_once 'universes.inc.php';
$lang = getLang();
$currUrl = '/ogame/calc/flight.php';

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'flight');

$countries = loadUniverseCountries($lang);
$universes = loadUniverses($countries);

require_once 'flight.tpl';
