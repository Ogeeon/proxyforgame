<?php
// Cache-busting stamps for stylesheet and script URLs: the file's content
// hash, not its mtime. The server ignores the query string, so an mtime-based
// stamp can serve two different bytes under one URL across a release switch
// (a stale cached page re-fetching one evicted script got the new release's
// copy), which is how a top-level const moved between files came to be
// declared twice in one page - Hawk, 2026-10-20..26, "Can't create duplicate
// variable". Hashing the bytes makes a URL mean exactly one content, forever.
// assetVersion('/full/path') hashes that file; assetVersion($base, '/rel')
// hashes $base . '/rel'.
function assetVersion($baseDir, $relPath = null) {
    static $versions = array();
    $key = ($relPath === null) ? $baseDir : $baseDir . $relPath;
    if (!isset($versions[$key])) {
        $hash = hash_file('crc32b', $key);
        $versions[$key] = ($hash === false) ? '0' : $hash;
    }
    return $versions[$key];
}
