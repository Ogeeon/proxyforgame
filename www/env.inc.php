<?php
// Reads the repo-root .env into the environment. Shared by the database layer
// and by page templates that only need a setting (hawk.tpl) - the latter must
// not pull in db.connect.inc.php, which opens a connection as it loads.

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
        // A real environment variable wins over the .env file (12-factor): this
        // lets docker-compose set DB_HOST=db without the bind-mounted repo .env
        // overriding it, and lets `make serve` honour a developer's customised
        // .env. On the hosts and in CI nothing sets a conflicting variable, so
        // .env still applies there.
        if (getenv($name) !== false) {
            continue;
        }
        putenv("$name=$value");
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

loadEnv(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');
