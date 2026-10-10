<?php
// The country/universe lists behind the universe pickers of the flight, costs
// and trade calculators. They come from the `countries`/`servers`/`universes`
// tables, which uni.list.cron.php refreshes from the Gameforge lobby once a day.
//
// A database on another machine makes every query a network round trip - one
// per country used to cost half a second a page. The lists are therefore read
// in two queries for all languages at once and kept in a file cache for
// UNIVERSE_CACHE_TTL seconds; a page view normally does not query them at all.
//
// Without a database both lists are empty and the picker offers nothing to
// choose from; every setting it would fill in stays editable by hand.

require_once __DIR__ . '/../../db.connect.inc.php';

// The lobby list is refreshed daily, so an hour of staleness costs nothing.
const UNIVERSE_CACHE_TTL = 3600;

/**
 * Where the cache lives: the system temp directory, outside the checkout, so
 * the deploy's `git clean` leaves it alone. The checkout path is part of the
 * name, so two sites on one machine do not read each other's lists.
 */
function universeCacheFile() {
    return sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pfg-universes-' . substr(hash('sha256', __DIR__), 0, 16) . '.json';
}

/**
 * Every country and universe row, from the cache when it is fresh, otherwise
 * from the database. Memoized for the request.
 *
 * @return array|false ['countries' => rows of [page_lang, lang, name, server],
 *                      'universes' => rows of [lang, server, name] sorted by name],
 *                     or FALSE when the database could not be asked
 */
function universeSnapshot() {
    static $snapshot = null;
    if ($snapshot === null) {
        $snapshot = readUniverseCache() ?? fetchUniverseSnapshot();
    }
    return $snapshot;
}

/**
 * The cached snapshot, or NULL when there is none younger than the TTL.
 */
function readUniverseCache() {
    $file = universeCacheFile();
    $mtime = @filemtime($file);
    if ($mtime === false || time() - $mtime >= UNIVERSE_CACHE_TTL) {
        return null;
    }
    $cached = json_decode((string)@file_get_contents($file), true);
    return is_array($cached) && isset($cached['countries'], $cached['universes']) ? $cached : null;
}

/**
 * Reads the snapshot from the database and caches it. A failure is not
 * cached: the next request asks again.
 *
 * @return array|false the snapshot, or FALSE when the database could not be asked
 */
function fetchUniverseSnapshot() {
    $countries = sqlQuery("SELECT c.lang AS page_lang, c.lang2 AS lang, c.name AS name, s.server AS server FROM countries AS c INNER JOIN servers AS s ON c.lang2 = s.lang ORDER BY c.lang, c.lang2", array());
    // Sorted per country by the database's collation, as the pickers always were
    $universes = sqlQuery("SELECT lang, server, name FROM universes ORDER BY lang, name", array());
    if ($countries === false || $universes === false) {
        return false;
    }
    $snapshot = array('countries' => $countries, 'universes' => $universes);

    // Written aside and renamed, so a concurrent reader never sees half a file.
    // A cache that cannot be written only costs the next request the two queries.
    $file = universeCacheFile();
    $tmp = $file . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, json_encode($snapshot)) !== false) {
        @rename($tmp, $file);
    }
    return $snapshot;
}

/**
 * Countries whose universes can be picked, with their names in the page language.
 *
 * @param string $lang page language
 * @return array|false rows of ['lang' => country code, 'name' => ..., 'server' => ...],
 *                     or FALSE when the database could not be asked
 */
function loadUniverseCountries($lang) {
    $snapshot = universeSnapshot();
    if ($snapshot === false) {
        return false;
    }
    $countries = array();
    foreach ($snapshot['countries'] as $row) {
        if ($row['page_lang'] === $lang) {
            $countries[] = array('lang' => $row['lang'], 'name' => $row['name'], 'server' => $row['server']);
        }
    }
    return $countries;
}

/**
 * The universes of every country in the list, sorted by name.
 *
 * @param array|false $countries what loadUniverseCountries() returned
 * @return array country code => list of ['server' => host, 'name' => ...]
 */
function loadUniverses($countries) {
    $universes = array();
    $snapshot = universeSnapshot();
    if (!$countries || $snapshot === false) {
        return $universes;
    }
    foreach ($countries as $row) {
        $universes[$row['lang']] = array();
    }
    foreach ($snapshot['universes'] as $u) {
        if (isset($universes[$u['lang']])) {
            $universes[$u['lang']][] = array('server' => $u['server'], 'name' => $u['name']);
        }
    }
    return $universes;
}

/**
 * The universe number out of its host name: 127 for s127-ru.ogame.gameforge.com.
 */
function universeNumber($server) {
    return preg_match('/^s(\d+)-/', $server, $m) ? (int)$m[1] : 0;
}

/**
 * The universe lists as a JavaScript literal for an inline script, each
 * universe as [number, name]. The hex flags keep a name with a quote or a
 * "</script>" from breaking out of it.
 *
 * @param array $universes what loadUniverses() returned
 */
function universesJs($universes) {
    // An empty PHP array would encode as [], but the client indexes it by country
    if (empty($universes)) {
        return '{}';
    }
    $lists = array();
    foreach ($universes as $lang => $list) {
        $lists[$lang] = array_map(fn($u) => array(universeNumber($u['server']), $u['name']), $list);
    }
    return json_encode($lists, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
}
