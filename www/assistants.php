<?php

// The page about the MCP server: how to use the calculators from ChatGPT,
// Claude and other AI assistants. Served at /<lang>/mcp - see PFG_PAGES in
// routes.inc.php for why the file has another name.

require_once 'langs.php';
$lang = getLang();
require_once 'routes.inc.php';
$currUrl = canonicalCalcPath('mcp');

require_once 'Intl.php';
$l = Intl::getTranslations($lang, 'assistants');
// The calculator names the page lists come from the sidebar's menu.
$menu = Intl::getTranslations($lang, 'sidebar')['ogameMenuItems'];

// Always the canonical host, whichever of the two domains served the page:
// clients connect to one address.
$mcpUrl = 'https://proxyforgame.com/mcp';

require_once 'assistants.tpl';
