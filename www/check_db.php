<?php
require 'db.connect.inc.php';

if (isset($connection) && $connection) {
    $res = mysqli_query($connection, "SELECT COUNT(*) AS c FROM universes WHERE lang='en'");
    if ($res) {
        $row = mysqli_fetch_assoc($res);
        echo "COUNT:" . $row['c'] . "\n";
    } else {
        echo "QUERY_FAILED: " . mysqli_error($connection) . "\n";
    }
} else {
    echo "NO_CONNECTION\n";
}
?>