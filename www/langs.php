<?php

/*
 * 1. берем язык из uri
 * 2. берем язык из accept
 * 3. окончательный язык = uri; если пусто, то accept; если пусто, то en; если не в списке допустимых; то en
 * 4. если язык в uri не указан, либо не совпадает с окончательным, то делаем редирект на новый uri с правильным языком
 */

function first_non_empty($s1, $s2) {
  return strlen($s1) > 0 ? $s1 : $s2;
}

$availLangs = '@^(en|us|ru|de|pl|es|fr|it|nl|sk|tr|pt|bs)$@';
$availLangsList = array('en' => 'English (GB)', 'us' => 'English (US)', 'ru' => 'Русский', 'de' => 'Deutsch', 'pl' => 'Polski', 'es' => 'Español', 'fr' => 'Français', 'it' => 'Italiano', 'nl' => 'Nederlands', 'sk' => 'Slovenčina', 'tr' => 'Türkçe', 'pt' => 'Português', 'bs' => 'Bosnian');

// 1. get language from request url
$uri = isset($_SERVER['ORIG_REQUEST_URI']) ? $_SERVER['ORIG_REQUEST_URI'] : $_SERVER['REQUEST_URI'];
$up = parse_url($uri);
$uriLang = preg_match('@^/(\w\w)((/.*)|$)@', $up['path'], $r) ? strtolower($r[1]) : '';

// 2. язык из заголовка Accept-Language
$acceptLang = isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) ? strtolower(substr(locale_accept_from_http($_SERVER['HTTP_ACCEPT_LANGUAGE']), 0, 2)) : '';

// 3. окончательный язык
$lang = first_non_empty(first_non_empty($uriLang, $acceptLang), 'en');
if (!preg_match($availLangs, $lang)) {
  $lang = (strlen($acceptLang) > 0 && preg_match($availLangs, $acceptLang)) ? $acceptLang : 'en';
}

// 4. редирект на скорректированный язык, если требуется
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

//echo $acceptLang.' | '.$_SERVER['REQUEST_URI'].' | ';

function get_lang() {
  global $lang;
  return $lang;
}
