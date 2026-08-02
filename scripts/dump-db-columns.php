<?php

/**
 * Prints the columns of the connected database as JSON, for
 * scripts/validate-database-schema.js to compare against schema.sql.
 *
 * Node has no MySQL driver in this project and the connection details already
 * live in .env behind www/db.connect.inc.php, so the read happens here.
 *
 * Exit codes: 0 - JSON on stdout; 2 - no database configured or reachable.
 */

require_once __DIR__ . '/../www/db.connect.inc.php';

global $connection;

if (!isset($connection) || $connection === false || $connection === null) {
    fwrite(STDERR, "no database connection\n");
    exit(2);
}

$rows = sqlQuery(
    'select table_name, column_name, column_type, is_nullable
     from information_schema.columns
     where table_schema = database()
     order by table_name, ordinal_position',
    array()
);

echo json_encode($rows === false ? array() : $rows);
