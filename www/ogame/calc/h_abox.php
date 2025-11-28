<?php
function KillInjection ($str)
    {
        $search = array ( "'<script[^>]*?>.*?</script>'si",  // Вырезает javaScript
                            "'<[\/\!]*?[^<>]*?>'si",         // Вырезает HTML-теги
                            "'([\r\n])[\s]+'" );             // Вырезает пробельные символы
        $replace = array ("", "", "\\1", "\\1" );
        $str = preg_replace($search, $replace, $str);
        $str = str_replace ("'", "", $str);
        $str = str_replace ("\"", "", $str);
        $str = str_replace ("%0", "", $str);
        $str = str_replace ('"', "", $str);
        return $str;
    }
    function UR_exists($url) {
       $headers = get_headers($url);
       return stripos($headers[0],"200 OK") ? true : false;
    }