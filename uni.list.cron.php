<?php

set_time_limit(1200);
error_reporting(E_ALL);

mb_internal_encoding("utf-8");

// нужны ли отладочные сообщения
define('DEBUG', false);
// нужны ли подробные ошибки от HttpRequest
define('HTTPREQ_DEBUG', true);
// нужны ли информативные сообщения для лога
define('LOG_ECHO', true);

define('OGAME_HOST', 'https://lobby.ogame.gameforge.com/api/servers');

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



// ********************************************************************************************
// обёртка для вывода ошибок в лог
// ********************************************************************************************
function sqlQuery($db, $sql)
{
	$res = array();

	if ($result = mysqli_query($db, $sql))
	{
		if ($result === TRUE) return FALSE; // для не-select'ов возвращаем FALSE, потому что нет результата
		while ($row = mysqli_fetch_assoc($result))
		    array_push($res, $row);
		mysqli_free_result($result);
	}
	else {
        echo "\n sql=$sql, err=".mysqli_errno($db)."\n";
        echo mysqli_error($db)."\n";
        return FALSE;
    };

	return count($res) > 0 ? $res : FALSE;
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
//           curl_setopt($curl, CURLOPT_HTTPHEADER, array_merge(getFirefoxHeaders(), $headers));
            curl_setopt($curl, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($curl, CURLOPT_CONNECTTIMEOUT, 10);
            curl_setopt($curl, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
            $out = curl_exec($curl);
            if(curl_errno($curl)){
                logDie("Curl error: " . curl_error($curl).", ".curl_getinfo($curl));
                //$inf = curl_getinfo($curl);
            }
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
            echo $uname."\n";
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

loadEnv(__DIR__ . DIRECTORY_SEPARATOR . '.env');

$connection = mysqli_connect(getenv('DB_HOST'), getenv('DB_USER'), getenv('DB_PASS'), getenv('DB_NAME'));
mysqli_set_charset($connection, 'utf8mb4');
saveData($connection, $unisArr);
mysqli_close($connection);

logDie('ok');
