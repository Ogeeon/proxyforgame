<?php

require_once 'langs.php';
$lang = getLang();
$currUrl = '/';
require_once 'Intl.php';
require_once __DIR__ . '/routes.inc.php';
$l = Intl::getTranslations($lang, 'index');

// One card per calculator, in the order of the sidebar menu: a visitor on a narrow screen,
// where the menu is folded away, sees every calculator and what it does on landing. The name
// is the menu's, the text the calculator's meta description.
$menuItems = Intl::block(Intl::getTranslations($lang, 'sidebar'), 'ogameMenuItems');
$calcCards = [];
foreach (pfgListedCalculators() as $calc) {
    $calcCards[] = [
        'url' => '/' . $lang . '/' . $calc,
        'title' => Intl::string($menuItems, $calc . '-title'),
        'description' => Intl::string(Intl::getTranslations($lang, $calc), 'description'),
    ];
}

require_once 'index.tpl';
