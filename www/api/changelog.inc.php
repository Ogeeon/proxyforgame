<?php
  // The in-app changelog the sidebar shows when a new release is published.

  require_once __DIR__ . '/http.inc.php';

  function getChangelog() {
    if (($lastSeen = getVar('lastSeen', 'int')) !== false && ($lang = getVar('lang', 'str')) !== false) {
      $langs = array('ru', 'de', 'es', 'pl', 'fr', 'it', 'nl', 'sk', 'tr', 'pt', 'en', 'us', 'bs');
      if (!in_array($lang, $langs)) {
        die("1\nmalformed");
      }
      if ($lang == 'us') {
        $lang = 'en';
      }
      $result = sqlQuery("select ch.ts, cd.description from change_headers ch join change_descriptions cd on (ch.id = cd.id)
        where lang like ? and ch.id > ? order by ch.id desc", array($lang, $lastSeen));
      $repsonse = json_encode($result);
      die('0\n'.$repsonse);
    }
    die("1\nmalformed");
  }
