<?php

require_once '../../langs.php';
$lang = getLang();
require_once '../../routes.inc.php';
$currUrl = canonicalCalcPath('moon');

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'moon');

require_once 'moon.tpl';

