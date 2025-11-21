<?php

$curl_handle=curl_init();
curl_setopt($curl_handle,CURLOPT_URL,'https://logserver.net/api/proxyforgame/?code=sr-ru-1-b7d7bbf9eb4ddeae981ea395f7e3474188e5f011');
curl_setopt($curl_handle,CURLOPT_CONNECTTIMEOUT,2);
curl_setopt($curl_handle,CURLOPT_RETURNTRANSFER,1);
$buffer = curl_exec($curl_handle);
curl_close($curl_handle);

if (empty($buffer))
{
    print "nuffing";
}
else
{
    print $buffer;
}

?>