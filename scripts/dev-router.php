<?php
// Router for PHP's built-in server - `make serve`, the Docker stack and CI:
//
//   php -S localhost:8000 -t www scripts/dev-router.php
//
// It does what the rewrite rules in www/.htaccess do on Apache, which the
// built-in server ignores: /ru -> /ru/, the /<lang>/ prefix stripped off the
// path, and the short calculator addresses. Anything it leaves alone it hands
// back to the server, which serves the file as usual.

require_once __DIR__ . '/../www/routes.inc.php';

$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';

if (preg_match('@^/(\w\w)$@', $requestPath, $m) && $requestPath !== '/js') {
    header('Location: /' . $m[1] . '/', true, 301);
    return true;
}

$path = $requestPath;
if (preg_match('@^/\w\w(/.*)$@', $path, $m) && !str_starts_with($path, '/js/')) {
    $path = $m[1];
}
if (preg_match('@^/([a-z0-9-]+)/?$@', $path, $m) && in_array($m[1], PFG_CALCULATORS, true)) {
    $path = '/ogame/calc/' . $m[1] . '.php';
}
if ($path === $requestPath) {
    return false;
}

if (str_ends_with($path, '/')) {
    $path .= 'index.php';
}
$docRoot = realpath($_SERVER['DOCUMENT_ROOT']);
$file = realpath($docRoot . $path);
// Only PHP pages are reached through a rewritten path; the site links its
// static files without a language prefix.
if ($file === false || !str_starts_with($file, $docRoot) || !str_ends_with($file, '.php')) {
    http_response_code(404);
    return true;
}

$_SERVER['SCRIPT_NAME'] = $_SERVER['PHP_SELF'] = $path;
$_SERVER['SCRIPT_FILENAME'] = $file;
// The controllers require their neighbours by paths relative to their own directory.
chdir(dirname($file));
require_once $file;
return true;
