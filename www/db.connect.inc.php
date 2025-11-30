<?php
mb_internal_encoding("utf-8");

function loadEnv($path) {
    if (!file_exists($path)) {
        // .env is optional in CI/test environments; log to stderr instead of echoing to page
        error_log(".env file not found at $path");
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

function SqlQuery($query) {	
    global $connection;
	$res = array();

    if (!isset($connection) || $connection === false || $connection === null) {
        return FALSE;
    }

	if ($result = mysqli_query($connection, $query)) {
		if ($result === TRUE) return FALSE; // для не-select'ов возвращаем FALSE, потому что нет результата
		while ($row = mysqli_fetch_assoc($result)) {
		    array_push($res, $row);
		}
		mysqli_free_result($result);
	} else {
		return FALSE;
	}

	return count($res) > 0 ? $res : FALSE;
	
}

function SqlQueryEscape($query, $params) {
    global $connection;
    $res = array();

    if (!isset($connection) || $connection === false || $connection === null) {
        return FALSE;
    }

    // Escape all parameters
    $escaped = array();
    foreach ($params as $param) {
        $escaped[] = is_null($param) ? 'NULL' : "'" . mysqli_real_escape_string($connection, $param) . "'";
    }

    // Replace ? placeholders with escaped values
    $finalQuery = $query;
    foreach ($escaped as $value) {
        $finalQuery = preg_replace('/\?/', $value, $finalQuery, 1);
    }

    if ($result = mysqli_query($connection, $finalQuery)) {
        if ($result === TRUE) return FALSE; // для не-select'ов возвращаем FALSE, потому что нет результата
        while ($row = mysqli_fetch_assoc($result)) {
            array_push($res, $row);
        }
        mysqli_free_result($result);
    } else {
        return FALSE;
    }

    return count($res) > 0 ? $res : FALSE;
}
	

loadEnv(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

$dbHost = getenv('DB_HOST');
$dbUser = getenv('DB_USER');
$dbPass = getenv('DB_PASS');
$dbName = getenv('DB_NAME');

if ($dbHost && $dbUser && $dbName) {
    // Attempt connection inside try/catch to avoid uncaught exceptions in environments
    // where MySQL server/socket is not available.
    try {
        // Suppress warnings from the underlying C library; exceptions will be caught below.
        $connection = @mysqli_connect($dbHost, $dbUser, $dbPass, $dbName);
        if ($connection) {
            mysqli_set_charset($connection, "utf8");
        } else {
            error_log("Could not connect to DB: host={$dbHost} user={$dbUser} db={$dbName}");
            $connection = false;
        }
    } catch (\mysqli_sql_exception $e) {
        error_log("mysqli_sql_exception while connecting to DB: " . $e->getMessage());
        $connection = false;
    }
} else {
    // No DB credentials provided (CI/test environment)
    $connection = false;
}

?>
