<?php
// The country/universe lists behind the universe pickers of the flight and
// costs calculators. Both come from the `countries`/`servers`/`universes`
// tables, which uni.list.cron.php refreshes from the Gameforge lobby.
//
// Without a database both lists are empty and the picker offers nothing to
// choose from; every setting it would fill in stays editable by hand.

require_once __DIR__ . '/../../db.connect.inc.php';

/**
 * Countries whose universes can be picked, with their names in the page language.
 *
 * @param string $lang page language
 * @return array rows of ['lang' => country code, 'name' => ..., 'server' => ...],
 *               or FALSE when the database could not be asked
 */
function loadUniverseCountries($lang) {
    return sqlQuery("SELECT c.lang2 as lang, c.name as name, s.server as server FROM countries AS c INNER JOIN servers as s ON c.lang2 = s.lang WHERE c.lang=?", array($lang));
}

/**
 * The universes of every country in the list, sorted by name.
 *
 * @param array|false $countries what loadUniverseCountries() returned
 * @return array country code => list of [universe number, universe name]
 */
function loadUniverses($countries) {
    $universes = array();
    if (!$countries) {
        return $universes;
    }
    foreach ($countries as $row) {
        $r = sqlQuery("SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(server, '-', 1), 's', -1) AS server_number, name FROM universes WHERE lang = ? ORDER BY 2", array($row['lang']));
        if ($r === false) {
            continue;
        }
        $universes[$row['lang']] = array_map(
            fn($u) => array((int)$u['server_number'], $u['name']),
            $r
        );
    }
    return $universes;
}

/**
 * The universe lists as a JavaScript literal for an inline script. The hex
 * flags keep a name with a quote or a "</script>" from breaking out of it.
 *
 * @param array $universes what loadUniverses() returned
 */
function universesJs($universes) {
    // An empty PHP array would encode as [], but the client indexes it by country
    if (empty($universes)) {
        return '{}';
    }
    return json_encode($universes, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
}
