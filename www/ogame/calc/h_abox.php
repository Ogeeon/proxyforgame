<?php
function killInjection ($str)
    {
        $search = array ( "'<script[^>]*?>.*?</script>'si",  // Strips javaScript
                            "'<[\/\!]*?[^<>]*?>'si",         // Strips HTML tags
                            "'([\r\n])[\s]+'" );             // Strips whitespace characters
        $replace = array ("", "", "\\1", "\\1" );
        $str = preg_replace($search, $replace, $str);
        $str = str_replace ("'", "", $str);
        $str = str_replace ("\"", "", $str);
        $str = str_replace ("%0", "", $str);
        $str = str_replace ('"', "", $str);
        return $str;
    }
    function urExists($url) {
       $headers = get_headers($url);
       return stripos($headers[0],"200 OK") ? true : false;
    }
