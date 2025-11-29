<?php

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$docroot = __DIR__;

// --------------------------------------------------------------------------
// 1. Block forbidden file types (.tpl, .cron.php, .inc.php)
// --------------------------------------------------------------------------
if (preg_match('/\.(tpl|cron\.php|inc\.php)$/i', $uri)) {
    header("HTTP/1.1 403 Forbidden");
    echo "403 Forbidden";
    exit;
}

// --------------------------------------------------------------------------
// 2. Serve existing static files normally
// --------------------------------------------------------------------------
$requested = $docroot . $uri;
if ($uri !== '/' && file_exists($requested) && !is_dir($requested)) {
    return false;
}

// --------------------------------------------------------------------------
// 3. Redirect /xx → /xx/  (language folder redirect to trailing slash)
// --------------------------------------------------------------------------
if (preg_match('#^/(\w\w)$#', $uri)) {
    header("Location: {$uri}/", true, 301);
    exit;
}

// --------------------------------------------------------------------------
// 4. Rewrite /xx/... → /... (strip 2-letter language prefix)
// --------------------------------------------------------------------------
if (preg_match('#^/\w\w/(.*)$#', $uri, $matches)) {
    $_SERVER['REQUEST_URI'] = '/' . $matches[1];
    $uri = $_SERVER['REQUEST_URI'];
}

// --------------------------------------------------------------------------
// 5. Remove cache-busting hashes from css/js filenames
//    e.g. /css/style.12345.css → /css/style.css
// --------------------------------------------------------------------------
if (preg_match('#^/(css|js)/(.*)\.[0-9]+\.(.*)$#', $uri, $m)) {
    $clean = "/{$m[1]}/{$m[2]}.{$m[3]}";
    if (file_exists($docroot . $clean)) {
        $_SERVER['REQUEST_URI'] = $clean;
        $uri = $clean;
    }
}

// ogame version
if (preg_match('#^/(ogame/calc/css|ogame/calc/js)/(.*)\.[0-9]+\.(.*)$#', $uri, $m)) {
    $clean = "/{$m[1]}/{$m[2]}.{$m[3]}";
    if (file_exists($docroot . $clean)) {
        $_SERVER['REQUEST_URI'] = $clean;
        $uri = $clean;
    }
}

// --------------------------------------------------------------------------
// 6. Everything else → index.php
// --------------------------------------------------------------------------
require $docroot . '/index.php';
