<?php

require_once('../../langs.php');
require_once('../../db.connect.inc.php');
$lang = get_lang();
$currUrl = '/ogame/calc/trade.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, 'trade');

$countries = SqlQuery("SELECT c.lang2 as lang, c.name as name, s.server as server FROM countries AS c INNER JOIN servers as s ON c.lang2 = s.lang WHERE c.lang=?", array($lang));
$universes = array();
if ($countries) {
	foreach ($countries as $row) {
		$r = SqlQuery("SELECT server, name FROM universes WHERE lang = ? ORDER BY name", array($row['lang']));
		if ($r === false)
			continue;
		$universes[$row['lang']] = $r;
	}
}
require_once('trade.tpl');

?>
