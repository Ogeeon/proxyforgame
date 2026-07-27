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

function sqlQuery($query, $params) {
    global $connection;
    $res = array();

    if (!isset($connection) || $connection === false || $connection === null) {
        return false;
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

    $result = mysqli_query($connection, $finalQuery);
    if ($result === false || $result === true) {
        // Query failed, or succeeded without a result set (not a SELECT); either way, no rows to return
        return false;
    }
    while ($row = mysqli_fetch_assoc($result)) {
        array_push($res, $row);
    }
    mysqli_free_result($result);

    return count($res) > 0 ? $res : false;
}


loadEnv(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

$dbHost = getenv('DB_HOST');
$dbUser = getenv('DB_USER');
$dbPass = getenv('DB_PASS');
$dbName = getenv('DB_NAME');

if ($dbHost && $dbName && $dbUser && $dbPass) {
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
}
