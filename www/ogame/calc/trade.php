<?php

require_once('../../langs.php');
require_once('../../db.connect.inc.php');
$lang = get_lang();
$currUrl = '/ogame/calc/trade.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, 'trade');

$countries = sqlQuery("SELECT c.lang2 as lang, c.name as name, s.server as server FROM countries AS c INNER JOIN servers as s ON c.lang2 = s.lang WHERE c.lang='$lang'");
$universes = array();
if ($countries) {
	foreach ($countries as $row) {
		$r = sqlQuery("SELECT server, name FROM universes WHERE lang = '{$row['lang']}' ORDER BY name");
		if ($r === false)
			continue;
		$universes[$row['lang']] = $r;
	}
}
require_once('trade.tpl');

?>
