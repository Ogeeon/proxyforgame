<?php

require_once '../../langs.php';
$lang = getLang();
$currUrl = '/ogame/calc/moon.php';

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'moon');

require_once 'moon.tpl';

