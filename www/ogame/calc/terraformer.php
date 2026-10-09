<?php

require_once '../../langs.php';
$lang = getLang();
require_once '../../routes.inc.php';
$currUrl = canonicalCalcPath('terraformer');

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'terraformer');

require_once 'terraformer.tpl';

