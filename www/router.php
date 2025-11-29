<?php

// Path to requested file
$path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

// Serve existing files directly
$file = __DIR__ . $path;
if (is_file($file)) {
    return false;
}

// --- Recreate .htaccess rewrite logic ---

// 1) Redirect /xx → /xx/
if (preg_match('#^/(\w\w)$#', $path)) {
    header("Location: $path/", true, 301);
    exit;
}

// 2) Strip /xx/ prefix unless it's /js or /js/... (according to your rules)
if (preg_match('#^/(\w\w)/(.*)$#', $path, $m)) {
    if (!preg_match('#^/js($|/)#', $path)) {
        // Forward internally without language code
        $_SERVER['REQUEST_URI'] = '/' . $m[2];
        $path = $_SERVER['REQUEST_URI'];
    }
}

// 3) Versioned assets: css|js|ogame/calc/css|ogame/calc/js
if (preg_match('#^/(css|js)/(.*)\.[0-9]+\.(.*)$#', $path, $m)) {
    $new = "/{$m[1]}/{$m[2]}.{$m[3]}";
    $_SERVER["REQUEST_URI"] = $new;
    $path = $new;
}
if (preg_match('#^/(ogame/calc/css|ogame/calc/js)/(.*)\.[0-9]+\.(.*)$#', $path, $m)) {
    $new = "/{$m[1]}/{$m[2]}.{$m[3]}";
    $_SERVER["REQUEST_URI"] = $new;
    $path = $new;
}

// After rewrite, compute final file path
$final = __DIR__ . $path;

// If file exists → serve it
if (is_file($final)) {
    return false;
}

// Default: pass request to index.php
$_SERVER["SCRIPT_NAME"] = '/index.php';
include __DIR__ . '/index.php';
