<?php
//
// Custom router for PHP built-in server to emulate your .htaccess rules
//

$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$docroot    = __DIR__;
$fullPath   = realpath($docroot . $requestUri);

//
// 1) Block access to .tpl, *.cron.php, *.inc.php  (from .htaccess: <Files> directive)
//
if (preg_match('/\.(tpl|cron\.php|inc\.php)$/i', $requestUri)) {
    header($_SERVER["SERVER_PROTOCOL"] . ' 403 Forbidden');
    exit("403 Forbidden");
}

//
// 2) Serve existing files directly
//
if ($fullPath && is_file($fullPath)) {
    return false; // Let built-in server handle it
}

//
// 3) Emulate RewriteRule: ^(\w\w)$ → /$1/   (language root redirect)
//
if (preg_match('#^/([A-Za-z]{2})$#', $requestUri, $m)) {
    header("Location: /{$m[1]}/", true, 301);
    exit;
}

//
// 4) Emulate RewriteRule:  ^\w\w/(.*)$  →  $1
//    BUT ONLY if the URL begins with two letters + slash
//
// .htaccess behavior:
//   /en/something → /something
//
if (preg_match('#^/[A-Za-z]{2}/(.*)$#', $requestUri, $m)) {
    $_SERVER['REQUEST_URI'] = '/' . $m[1];
    $_GET = []; // clear GET (your rewrite rule discards extra query string)
    include $docroot . '/index.php';
    exit;
}

//
// 5) Emulate asset version cleanup:
//    /css/file.12345.css → /css/file.css
//
if (preg_match('#^/(css|js)/(.*)\.[0-9]+\.(.*)$#', $requestUri, $m)) {
    $cleanPath = "/{$m[1]}/{$m[2]}.{$m[3]}";
    $fp = realpath($docroot . $cleanPath);
    if ($fp && is_file($fp)) {
        return false;
    }
}

//
// 6) OGame calc assets version cleanup (your second rule)
//
if (preg_match('#^/(ogame/calc/css|ogame/calc/js)/(.*)\.[0-9]+\.(.*)$#', $requestUri, $m)) {
    $cleanPath = "/{$m[1]}/{$m[2]}.{$m[3]}";
    $fp = realpath($docroot . $cleanPath);
    if ($fp && is_file($fp)) {
        return false;
    }
}

//
// 7) Default: route everything to index.php
//
include $docroot . '/index.php';
