<?php

/*
 * 1. take the language from the uri
 * 2. take the language from accept
 * 3. final language = uri; if empty, then accept; if empty, then en; if not in the allowed list, then en
 * 4. if the language is not specified in the uri, or does not match the final language, redirect to a new uri with the correct language
 */

function firstNonEmpty($s1, $s2) {
  return strlen($s1) > 0 ? $s1 : $s2;
}

$availLangs = '@^(en|us|ru|de|pl|es|fr|it|nl|sk|tr|pt|bs)$@';
$availLangsList = array('en' => 'English (GB)', 'us' => 'English (US)', 'ru' => 'Русский', 'de' => 'Deutsch', 'pl' => 'Polski', 'es' => 'Español', 'fr' => 'Français', 'it' => 'Italiano', 'nl' => 'Nederlands', 'sk' => 'Slovenčina', 'tr' => 'Türkçe', 'pt' => 'Português', 'bs' => 'Bosnian');

// 1. get language from request url
$uri = isset($_SERVER['ORIG_REQUEST_URI']) ? $_SERVER['ORIG_REQUEST_URI'] : $_SERVER['REQUEST_URI'];
$up = parse_url($uri);
$uriLang = preg_match('@^/(\w\w)((/.*)|$)@', $up['path'], $r) ? strtolower($r[1]) : '';

// 2. language from the Accept-Language header
$acceptLang = isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) ? strtolower(substr(locale_accept_from_http($_SERVER['HTTP_ACCEPT_LANGUAGE']), 0, 2)) : '';

// 3. final language
$lang = firstNonEmpty(firstNonEmpty($uriLang, $acceptLang), 'en');
if (!preg_match($availLangs, $lang)) {
  $lang = (strlen($acceptLang) > 0 && preg_match($availLangs, $acceptLang)) ? $acceptLang : 'en';
}

// 4. redirect to the corrected language, if needed
// BUT: only redirect if user explicitly used a WRONG language prefix (e.g., /xx/path where xx is invalid)
// If no language prefix was used at all, accept the default language without redirecting
if ($uriLang != '' && $uriLang != $lang) {
  // User provided a language prefix, but it was invalid or needs correction
  $up['path'] = preg_replace('@^/(\w\w)(/.*)@', '/' . $lang . '$2', $up['path']);
  $newuri = $up['path'] . ((isset($up['query']) && strlen($up['query']) > 0) ? '?' . $up['query'] : '');
  // Use a relative redirect to avoid host-name mismatches (localhost vs 127.0.0.1)
  // which can cause infinite redirect loops in CI environments.
  header('Location: ' . $newuri);
  die();
}

function getLang() {
  global $lang;
  return $lang;
}
