<?php

require_once '../../langs.php';
$lang = getLang();
require_once '../../routes.inc.php';
$currUrl = canonicalCalcPath('graviton');

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'graviton');

require_once 'graviton.tpl';

