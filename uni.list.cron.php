<?php

set_time_limit(1200);
error_reporting(E_ALL);

mb_internal_encoding("utf-8");

// ********************************************************************************************
// константы
// ********************************************************************************************
//$secrets = require_once('/var/secret/proxyforgame.com/secret.php');

// нужны ли отладочные сообщения
define('DEBUG', true);
// нужны ли подробные ошибки от HttpRequest
define('HTTPREQ_DEBUG', true);
// нужны ли информативные сообщения для лога
define('LOG_ECHO', true);

define('OGAME_HOST', 'https://lobby.ogame.gameforge.com/api/servers');

define('DB_HOST', 'localhost');
define('DB_NAME', 'proxyforgame_ogame');
define('DB_USER', 'proxyforgame');
//define('DB_PASS', isset($secrets['db.password']) ? $secrets['db.password'] : 'secret');
define('DB_PASS', 'secret');


// ********************************************************************************************
// враппер над pg_query, чтобы показывать ошибки
// ********************************************************************************************
function sqlQuery($db, $sql)
{
    $r = pg_query($db, $sql);
    if ($r === false) logDie('Error: SQL query failed [' . pg_last_error($db) . ']; query was: `' . $sql . '`');
    return $r;
}

// ********************************************************************************************
// выводит сообщение в лог и останавливает программу
// ********************************************************************************************
function logDie($mes)
{
    if (DEBUG || LOG_ECHO) echo '[' . date('Y-m-d H:i:s') . '] ' . "$mes\n";
    die();
}

// ********************************************************************************************
// возвращает массив заголовков как у лисы
// ********************************************************************************************
function getFirefoxHeaders()
{
    return [
        'User-Agent' => 'Mozilla/5.0 (Windows; U; Windows NT 5.1; ru; rv:1.9.0.17) Gecko/2009122116 Firefox/3.0.17',
        'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language' => 'ru,en-us;q=0.7,en;q=0.3',
        'Accept-Charset' => 'UTF-8,*'
    ];
}

function httpGet($uri, $headers = [])
{
    try {
        if ($curl = curl_init()) {
            curl_setopt($curl, CURLOPT_URL, $uri);
            curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($curl, CURLOPT_POST, false);
            curl_setopt($curl, CURLOPT_HTTPHEADER, array_merge(getFirefoxHeaders(), $headers));
            curl_setopt($curl, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($curl, CURLOPT_CONNECTTIMEOUT, 10);
            $out = curl_exec($curl);
            curl_close($curl);
            return $out;
        } else {
            logDie("Failed to initialize curl");
        }
    } catch (Exception $e) {
        logDie("Failed to get $uri: " . $e->getMessage());
    }
}

// ********************************************************************************************
// сохраняет данные результата в базу
// ********************************************************************************************
function saveData($db, $allData)
{
    sqlQuery($db, "TRUNCATE TABLE universes");

    // добавляем вселенные в `universes`
    $sid = 1; // для сортировки
    foreach ($allData as $ulang => $uni) {
        foreach ($uni as $userver => $uname) {
            sqlQuery($db, "INSERT INTO universes (lang, sid, server, name) VALUES ('$ulang', $sid, '$userver', '$uname')");
            $sid++;
        }
    }
}


// ********************************************************************************************
// парсит список вселенных
// возвращает массив вселенных с записями вида ['ru'][['s127-ru.ogame.gameforge.com' => name='Andromeda'], ...]
// ********************************************************************************************
function parseUniverses($data)
{
    $r = [];
    for ($i = 0; $i < count($data); $i++) {
        $host = 's' . $data[$i]['number'] . '-' . $data[$i]['language'] . '.ogame.gameforge.com';
        $r[$data[$i]['language']][$host] = $data[$i]['name'];
    }
    return $r;
}


// ********************************************************************************************

$r = httpGet(OGAME_HOST);
$unis = json_decode($r, true);
$unisArr = parseUniverses($unis);

/*
$servers = parseServers($r);

$countryServers = [];
$countryNames = [];
$unis = [];
foreach ($servers as $server) {
  $lang = $server['lang'];
  $countryServers[$lang] = $server['uri'];
  foreach ($servers as $server2) {
    $lang2 = $server2['lang'];
    $countryNames[$lang][$lang2] = $server2['name'];
  }

  $cr = httpGet('https://' . $server['uri']);
  $cu = parseUniverses($cr);
  foreach ($cu as $cuhost => $cuname) {
    $unis[$lang][$cuhost] = $cuname;
  }
}
$data = ['servers' => $countryServers, 'countries' => $countryNames, 'universes' => $unis];
*/
// коннектимся к БД
$db = pg_connect('host='.DB_HOST.' dbname='.DB_NAME.' user='.DB_USER.' password='.DB_PASS) or logDie('Error: couldn`t connect to db [' . pg_last_error() . ']');
saveData($db, $unisArr);
pg_close($db);

logDie('ok');
