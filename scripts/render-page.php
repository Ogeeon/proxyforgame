<?php

/**
 * Render a page without a web server, for offline HTML validation.
 *
 * Usage: php scripts/render-page.php <page> [<lang>]
 *   page - one of: index, policy, or a calculator name (costs, expeditions,
 *          flight, graviton, lfcosts, moon, production, queue, terraformer, trade)
 *   lang - locale code, default 'en' (ignored by policy, which is static)
 *
 * Renders in "production" mode (HTTP_HOST=proxyforgame.com) so the cookie
 * banner and analytics blocks - what the site really serves - are included,
 * and so filemtime() versioning resolves through DOCUMENT_ROOT instead of a
 * hardcoded Windows path.
 *
 * Prints the rendered HTML to stdout. PHP notices/warnings are silenced and
 * never touch stdout, so the stream is pure HTML.
 */

$page = isset($argv[1]) ? $argv[1] : '';
$lang = isset($argv[2]) ? $argv[2] : 'en';

$wwwRoot = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'www';

$calculators = array('costs', 'expeditions', 'flight', 'graviton', 'lfcosts', 'moon', 'production', 'queue', 'terraformer', 'trade');

if ($page === 'index') {
    $reqUri = '/' . $lang . '/';
} elseif ($page === 'policy') {
    $reqUri = '/policy.php';
} elseif (in_array($page, $calculators, true)) {
    $reqUri = '/' . $lang . '/ogame/calc/' . $page . '.php';
} else {
    fwrite(STDERR, "render-page.php: unknown page \"$page\"\n");
    exit(1);
}

// "Production" host: enables cookies.tpl / analitics.tpl and the
// DOCUMENT_ROOT-based $pfgPath branch in the templates.
$_SERVER['HTTP_HOST'] = 'proxyforgame.com';
$_SERVER['SERVER_NAME'] = 'proxyforgame.com';
$_SERVER['DOCUMENT_ROOT'] = $wwwRoot;
$_SERVER['REQUEST_URI'] = $reqUri;
$_SERVER['ORIG_REQUEST_URI'] = $reqUri;
$_SERVER['SCRIPT_NAME'] = $reqUri;
$_SERVER['PHP_SELF'] = $reqUri;

// No notices (e.g. missing database) may pollute the HTML stream.
error_reporting(0);
ini_set('display_errors', '0');

// Relative requires in the templates are CWD-based (the `../../x.php` forms
// never fall back to the including file's directory). Apache's mod_php chdirs
// to the entry script, so mirror that: index runs from www/, calculators from
// www/ogame/calc/ (where `../../langs.php` reaches www/), policy is static.
if ($page === 'policy') {
    chdir($wwwRoot);
    readfile($wwwRoot . DIRECTORY_SEPARATOR . 'policy.php');
} elseif ($page === 'index') {
    chdir($wwwRoot);
    require_once $wwwRoot . DIRECTORY_SEPARATOR . 'index.php';
} else {
    chdir($wwwRoot . DIRECTORY_SEPARATOR . 'ogame' . DIRECTORY_SEPARATOR . 'calc');
    require_once $wwwRoot . DIRECTORY_SEPARATOR . 'ogame' . DIRECTORY_SEPARATOR . 'calc' . DIRECTORY_SEPARATOR . $page . '.php';
}
