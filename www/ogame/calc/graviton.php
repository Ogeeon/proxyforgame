<?php

require_once '../../langs.php';
$lang = getLang();
$currUrl = '/ogame/calc/graviton.php';

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'graviton');

require_once 'graviton.tpl';

