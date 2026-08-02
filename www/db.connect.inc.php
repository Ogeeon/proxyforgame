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

/**
 * Runs a SELECT and returns its rows.
 *
 * Returns an array of rows - empty when the query matched nothing - or FALSE
 * when the query could not be run at all: no connection, a prepare/execute
 * failure, or a statement that yields no result set. Callers that need to tell
 * "nothing found" from "could not ask" must compare against FALSE explicitly.
 *
 * Parameters are bound, never interpolated. Every one of them is bound as a
 * string; MySQL coerces on comparison, which is what the previous quote-and-
 * splice code did too.
 */
function sqlQuery($query, $params) {
    global $connection;

    if (!isset($connection) || $connection === false || $connection === null) {
        return false;
    }

    // From PHP 8.1 on, mysqli throws instead of returning false. Catch it here
    // so this function keeps one contract across every version we run on.
    try {
        return runPreparedSelect($connection, $query, $params);
    } catch (\mysqli_sql_exception $e) {
        error_log("sqlQuery: " . $e->getMessage());
        return false;
    }
}

/** The statement half of sqlQuery(); throws on the versions where mysqli does. */
function runPreparedSelect($connection, $query, $params) {
    $stmt = mysqli_prepare($connection, $query);
    if ($stmt === false) {
        error_log("sqlQuery: prepare failed: " . mysqli_error($connection));
        return false;
    }

    if (count($params) > 0) {
        mysqli_stmt_bind_param($stmt, str_repeat('s', count($params)), ...$params);
    }

    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    // Not a SELECT, so there is no result set to hand back
    if ($result === false) {
        mysqli_stmt_close($stmt);
        return false;
    }

    $res = array();
    while ($row = mysqli_fetch_assoc($result)) {
        array_push($res, $row);
    }
    mysqli_free_result($result);
    mysqli_stmt_close($stmt);

    return $res;
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
