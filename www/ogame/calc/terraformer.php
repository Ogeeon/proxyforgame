<?php

require_once '../../langs.php';
$lang = getLang();
$currUrl = '/ogame/calc/terraformer.php';

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'terraformer');

require_once 'terraformer.tpl';

