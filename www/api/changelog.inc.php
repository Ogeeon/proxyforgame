<?php
  // The in-app changelog the sidebar shows when a new release is published.

  require_once __DIR__ . '/http.inc.php';
  require_once __DIR__ . '/../Intl.php';

  function apiChangelog($in) {
    $lastSeen = requireParam($in, 'lastSeen', 'int', 'bad_request');
    $lang = requireParam($in, 'lang', 'str', 'bad_request');

    // The locale files are the list of languages; langs.php cannot be included
    // here because it answers with a redirect.
    if (!Intl::hasLocale($lang)) {
      throw new ApiError(400, 'bad_request', "Unknown locale: $lang");
    }
    if ($lang === 'us') {
      $lang = 'en';
    }

    $rows = sqlQuery("select ch.ts, cd.description from change_headers ch join change_descriptions cd on (ch.id = cd.id)
      where lang like ? and ch.id > ? order by ch.id desc", array($lang, $lastSeen));

    if ($rows === false) {
      throw new ApiError(500, 'internal_error', 'The changelog query could not be run');
    }

    return $rows;
  }
