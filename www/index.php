<?php

require_once 'langs.php';
$lang = getLang();
$currUrl = '/';
require_once 'Intl.php';
require_once __DIR__ . '/routes.inc.php';
$l = Intl::getTranslations($lang, 'index');

/**
 * The array under $key in a translation block, or an empty one when there is none.
 *
 * @return array<array-key, mixed>
 */
function translationBlock(mixed $block, string $key): array
{
    return is_array($block) && is_array($block[$key] ?? null) ? $block[$key] : [];
}

/**
 * The string under $key in a translation block, or '' when there is none.
 */
function translationString(mixed $block, string $key): string
{
    return is_array($block) && is_string($block[$key] ?? null) ? $block[$key] : '';
}

/**
 * One card per calculator, in the order of the sidebar menu: a visitor on a narrow screen,
 * where the menu is folded away, sees every calculator and what it does on landing. The name
 * is the menu's, the text the calculator's meta description.
 *
 * @return list<array{url: string, title: string, description: string}>
 */
function homeCalcCards(string $lang): array
{
    $menuItems = translationBlock(Intl::getTranslations($lang, 'sidebar'), 'ogameMenuItems');
    $cards = [];
    foreach (PFG_CALCULATORS as $calc) {
        $cards[] = [
            'url' => '/' . $lang . '/' . $calc,
            'title' => translationString($menuItems, $calc . '-title'),
            'description' => translationString(Intl::getTranslations($lang, $calc), 'description'),
        ];
    }
    return $cards;
}

$calcCards = homeCalcCards(is_string($lang) ? $lang : 'en');

require_once 'index.tpl';
