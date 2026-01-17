<?php

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

function getPopulation($universe, $country, $pdo) {
    // Fetch server data to get galaxies and systems counts
    $serverDataUrl = "https://s{$universe}-{$country}.ogame.gameforge.com/api/serverData.xml";
    
    $serverDataContent = @file_get_contents($serverDataUrl);
    
    if ($serverDataContent === false) {
        throw new Exception('Failed to fetch server data');
    }
    
    $serverDataXml = simplexml_load_string($serverDataContent);
    
    if ($serverDataXml === false) {
        throw new Exception('Failed to parse server data XML');
    }

    if ((int)$serverDataXml->fleetIgnoreEmptySystems !== 1) {
        return [
            'timestamp' => 0,
            'population' => 0
        ];
    }
    
    // Extract galaxies and systems counts
    $maxGalaxy = (int)$serverDataXml->galaxies;
    $maxSystem = (int)$serverDataXml->systems;
    
    // Fetch players data to determine inactive players
    $playersUrl = "https://s{$universe}-{$country}.ogame.gameforge.com/api/players.xml";
    
    $playersContent = @file_get_contents($playersUrl);
    
    if ($playersContent === false) {
        throw new Exception('Failed to fetch players data');
    }
    
    $playersXml = simplexml_load_string($playersContent);
    
    if ($playersXml === false) {
        throw new Exception('Failed to parse players XML');
    }
    
    // Build set of inactive player IDs
    $inactivePlayers = [];
    
    foreach ($playersXml->player as $player) {
        $playerId = (int)$player['id'];
        $status = (string)$player['status'];
        
        // Check if status contains 'i' or 'I' (inactive), 'v' for vacation, 'b' for banned
        if (preg_match('/[ivb]/i', $status)) {
            $inactivePlayers[$playerId] = true;
        }
    }
    
    // Fetch universe data
    $universeUrl = "https://s{$universe}-{$country}.ogame.gameforge.com/api/universe.xml";
    echo "Fetching universe data from: $universeUrl\n";
    $xmlContent = @file_get_contents($universeUrl);
    
    if ($xmlContent === false) {
        throw new Exception('Failed to fetch universe data');
    }
    
    // Parse XML
    $xml = simplexml_load_string($xmlContent);
    
    if ($xml === false) {
        throw new Exception('Failed to parse universe XML');
    }
    
    $timestamp = (int)$xml['timestamp'];
    
    // Collect all populated systems organized by galaxy
    // Only count planets belonging to active players
    $populatedSystems = [];
    
    foreach ($xml->planet as $planet) {
        $playerId = (int)$planet['player'];
        
        // Skip planets owned by inactive players
        if (isset($inactivePlayers[$playerId])) {
            continue;
        }
        
        $coords = (string)$planet['coords'];
        list($galaxy, $system, $position) = explode(':', $coords);
        
        $galaxy = (int)$galaxy;
        $system = (int)$system;
        
        if (!isset($populatedSystems[$galaxy])) {
            $populatedSystems[$galaxy] = [];
        }
        if (in_array($system,$populatedSystems[$galaxy]) === false) {
            $populatedSystems[$galaxy][] = $system;            
        }
    }
    
    // Sort systems within each galaxy
    foreach ($populatedSystems as &$systems) {
        sort($systems);
    }
    unset($systems);
    
    // Store in database
    $stmt = $pdo->prepare("
        INSERT INTO population_data (country, universe, timestamp, population)
        VALUES (:country, :universe, :timestamp, :population)
        ON DUPLICATE KEY UPDATE
            timestamp = :timestamp,
            population = :population
    ");
    
    $populatedSystemsJson = json_encode($populatedSystems);
    
    $stmt->execute([
        ':country' => $country,
        ':universe' => $universe,
        ':timestamp' => $timestamp,
        ':population' => $populatedSystemsJson
    ]);

    return [
        'timestamp' => $timestamp,
        'population' => $populatedSystemsJson
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

    // $results = updateAllUniverses($pdo);
    $results = getPopulation(178, 'ru', $pdo);
    echo json_encode($results, JSON_PRETTY_PRINT);  
} catch (Exception $e) {
    echo $e->getMessage();
}
?>

