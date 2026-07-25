<?php

class ServerDataFetchException extends Exception {}
class ServerDataParseException extends Exception {}
class PlayersDataFetchException extends Exception {}
class PlayersDataParseException extends Exception {}
class UniverseDataFetchException extends Exception {}
class UniverseDataParseException extends Exception {}
class DatabaseException extends Exception {}

function loadEnv($path) {
    if (!file_exists($path)) {
        echo ".env file not found at $path";
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        list($name, $value) = array_map('trim', explode('=', $line, 2));
        putenv("$name=$value");
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

function buildInactivePlayers($playersXml) {
    $inactivePlayers = [];
    foreach ($playersXml->player as $player) {
        $playerId = (int)$player['id'];
        $status = (string)$player['status'];
        if (preg_match('/[ib]/i', $status)) {
            $inactivePlayers[$playerId] = true;
        }
    }
    return $inactivePlayers;
}

/** Turns the galaxy => system => true sets into galaxy => sorted system list. */
function finalizePopulatedSystems($sets) {
    ksort($sets);
    $result = [];
    foreach ($sets as $galaxy => $systems) {
        $list = array_keys($systems);
        sort($list);
        $result[$galaxy] = $list;
    }
    return $result;
}

/**
 * Systems holding at least one planet, in two flavours: `active` leaves out the
 * planets of inactive players, `all` counts every planet.
 *
 * The universe has two independent settings for this — one skips systems nobody
 * lives in, the other skips systems where every player is inactive — so neither
 * set alone answers the question. Both are stored, and the calculator combines
 * them according to the flags the universe actually has switched on.
 */
function buildPopulatedSystems($xml, $inactivePlayers) {
    $active = [];
    $all = [];
    foreach ($xml->planet as $planet) {
        $coords = (string)$planet['coords'];
        [$galaxy, $system] = explode(':', $coords);
        $galaxy = (int)$galaxy;
        $system = (int)$system;
        $all[$galaxy][$system] = true;
        if (!isset($inactivePlayers[(int)$planet['player']])) {
            $active[$galaxy][$system] = true;
        }
    }
    return [
        'active' => finalizePopulatedSystems($active),
        'all' => finalizePopulatedSystems($all)
    ];
}

function getPopulation($universe, $country, $pdo) {
    // Fetch server data to get galaxies and systems counts
    $serverDataUrl = "https://s{$universe}-{$country}.ogame.gameforge.com/api/serverData.xml";
    
    $serverDataContent = @file_get_contents($serverDataUrl);
    
    if ($serverDataContent === false) {
        throw new ServerDataFetchException('Failed to fetch server data');
    }
    
    $serverDataXml = simplexml_load_string($serverDataContent);
    
    if ($serverDataXml === false) {
        throw new ServerDataParseException('Failed to parse server data XML');
    }

    // The two settings are independent. An empty tag counts as 0, and when both
    // are off the fleet crosses every system, so there is nothing to store.
    $ignoreEmpty = (int)$serverDataXml->fleetIgnoreEmptySystems === 1;
    $ignoreInactive = (int)$serverDataXml->fleetIgnoreInactiveSystems === 1;

    if (!$ignoreEmpty && !$ignoreInactive) {
        return [
            'timestamp' => 0,
            'population' => 0
        ];
    }

    // Fetch players data to determine inactive players
    $playersUrl = "https://s{$universe}-{$country}.ogame.gameforge.com/api/players.xml";
    
    $playersContent = @file_get_contents($playersUrl);
    
    if ($playersContent === false) {
        throw new PlayersDataFetchException('Failed to fetch players data');
    }
    
    $playersXml = simplexml_load_string($playersContent);
    
    if ($playersXml === false) {
        throw new PlayersDataParseException('Failed to parse players XML');
    }
    
    $inactivePlayers = buildInactivePlayers($playersXml);
    
    // Fetch universe data
    $universeUrl = "https://s{$universe}-{$country}.ogame.gameforge.com/api/universe.xml";
    echo "Fetching universe data from: $universeUrl\n";
    $xmlContent = @file_get_contents($universeUrl);
    
    if ($xmlContent === false) {
        throw new UniverseDataFetchException('Failed to fetch universe data');
    }
    
    // Parse XML
    $xml = simplexml_load_string($xmlContent);
    
    if ($xml === false) {
        throw new UniverseDataParseException('Failed to parse universe XML');
    }
    
    $timestamp = (int)$xml['timestamp'];
    $populatedSystems = buildPopulatedSystems($xml, $inactivePlayers);

    // Store in database. updated_at is assigned explicitly rather than left to
    // ON UPDATE CURRENT_TIMESTAMP, which does not fire when the new row happens to
    // be identical to the old one — the run that changed nothing is exactly the
    // run whose freshness we still need to record.
    $stmt = $pdo->prepare("
        INSERT INTO population_data (country, universe, timestamp, population, population_all, updated_at)
        VALUES (:country, :universe, :timestamp, :population, :population_all, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
            timestamp = :timestamp,
            population = :population,
            population_all = :population_all,
            updated_at = CURRENT_TIMESTAMP
    ");

    $populatedSystemsJson = json_encode($populatedSystems['active']);
    $populatedSystemsAllJson = json_encode($populatedSystems['all']);

    $stmt->execute([
        ':country' => $country,
        ':universe' => $universe,
        ':timestamp' => $timestamp,
        ':population' => $populatedSystemsJson,
        ':population_all' => $populatedSystemsAllJson
    ]);

    return [
        'timestamp' => $timestamp,
        'population' => $populatedSystemsJson,
        'populationAll' => $populatedSystemsAllJson
    ];
}

function parseServerString($server) {
    // Extract universe and country from format: s1-en.ogame.gameforge.com
    if (preg_match('/^s(\d+)-([a-z]{2})\.ogame\.gameforge\.com$/', $server, $matches)) {
        return [
            'universe' => $matches[1],
            'country' => $matches[2]
        ];
    }
    return null;
}

function updateAllUniverses($pdo) {
    $results = [
        'success' => [],
        'failed' => []
    ];
    
    // Fetch all universes
    $stmt = $pdo->query("SELECT server FROM universes");
    $universes = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    foreach ($universes as $server) {
        $parsed = parseServerString($server);
        
        if ($parsed === null) {
            $results['failed'][] = [
                'server' => $server,
                'error' => 'Invalid server format'
            ];
            continue;
        }
        
        try {
            $response = getPopulation($parsed['universe'], $parsed['country'], $pdo);
            $results['success'][] = [
                'server' => $server,
                'universe' => $parsed['universe'],
                'country' => $parsed['country'],
                'timestamp' => $response['timestamp']
            ];
        } catch (Exception $e) {
            $results['failed'][] = [
                'server' => $server,
                'universe' => $parsed['universe'],
                'country' => $parsed['country'],
                'error' => $e->getMessage()
            ];
        }
    }
    
    return $results;
}

try {
    loadEnv(__DIR__ . DIRECTORY_SEPARATOR . '.env');
    $dbHost = getenv('DB_HOST');
    $dbName = getenv('DB_NAME');
    $dbUser = getenv('DB_USER');
    $dbPass = getenv('DB_PASS');
    
    $pdo = new PDO(
        "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4",
        $dbUser,
        $dbPass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );

    $results = updateAllUniverses($pdo);
    // $results = getPopulation(178, 'ru', $pdo);
    echo json_encode($results, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo $e->getMessage();
}
