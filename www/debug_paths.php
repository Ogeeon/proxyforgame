<?php
header('Content-Type: text/plain; charset=utf-8');
echo "DEBUG PATHS\n";
echo "REQUEST_URI=" . (isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '-') . "\n";
echo "ORIG_REQUEST_URI=" . (isset($_SERVER['ORIG_REQUEST_URI']) ? $_SERVER['ORIG_REQUEST_URI'] : '-') . "\n";
echo "PHP SCRIPT_NAME=" . (isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '-') . "\n";
echo "__DIR__=" . __DIR__ . "\n";
echo "getcwd=" . getcwd() . "\n";
$test = __DIR__ . '/ogame/calc/trade.php';
echo "TEST_PATH=" . $test . "\n";
echo "file_exists=" . (file_exists($test) ? '1' : '0') . "\n";
echo "is_file=" . (is_file($test) ? '1' : '0') . "\n";
echo "realpath=" . (realpath($test) ?: '-') . "\n";
?>