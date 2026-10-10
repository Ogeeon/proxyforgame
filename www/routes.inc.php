<?php
// Calculator addresses. Every calculator answers on exactly one URL,
// /<lang>/<calc>, and redirects any other spelling of it there: the old
// /ogame/calc/<calc>.php path, a missing language prefix, a trailing slash.
//
// The mapping from the short URL to the controller lives in www/.htaccess on
// Apache, which carries its own copy of this list, and in scripts/dev-router.php
// under the built-in server, which reads it from here.

const PFG_CALCULATORS = array(
    'costs', 'expeditions', 'flight', 'graviton', 'lfcosts',
    'moon', 'production', 'queue', 'terraformer', 'trade',
);

/**
 * Redirects the request to /<lang>/<calc> unless it already arrived there,
 * and returns the calculator's path without the language prefix - what the
 * language switcher appends to each /<lang>.
 *
 * A request that carried a language prefix gets a permanent redirect. One
 * without it gets a temporary one, because its target depends on the
 * visitor's Accept-Language and must not be cached for everyone.
 */
function canonicalCalcPath($calc) {
    $path = '/' . $calc;
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'GET' && $method !== 'HEAD') {
        return $path;
    }

    $uri = $_SERVER['ORIG_REQUEST_URI'] ?? $_SERVER['REQUEST_URI'];
    $parts = parse_url($uri);
    $requested = $parts['path'] ?? '';
    $target = '/' . getLang() . $path;
    if ($requested === $target) {
        return $path;
    }

    $query = $parts['query'] ?? '';
    $hasPrefix = preg_match('@^/\w\w/@', $requested) === 1;
    if (!$hasPrefix) {
        header('Vary: Accept-Language');
    }
    // Relative, like the language redirect in langs.php: no host name to get wrong.
    header('Location: ' . $target . ($query !== '' ? '?' . $query : ''), true, $hasPrefix ? 301 : 302);
    exit;
}
