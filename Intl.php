<?php
/*
Using username "avbogatyrev".
Authenticating with public key "imported-openssh-key"
Welcome to Ubuntu 14.04.6 LTS (GNU/Linux 2.6.32-042stab127.2 x86_64)

 * Documentation:  https://help.ubuntu.com/
Last login: Wed Mar 18 14:10:12 2020 from 87.225.43.182
avbogatyrev@new:~$ php -v
PHP 5.5.9-1ubuntu4.27 (cli) (built: Mar  5 2019 18:56:49)
Copyright (c) 1997-2014 The PHP Group
Zend Engine v2.5.0, Copyright (c) 1998-2014 Zend Technologies
    with Zend OPcache v7.0.3, Copyright (c) 1999-2014, by Zend Technologies
avbogatyrev@new:~$

*/

/**
 * Manage the internationalization of the site.
 */
class Intl
{
    const DEFAULT_LOCALE = 'en'; // Default locale
    //private var $locale_dir = __DIR__.'/locale'; // Locales directory.

    static $locales; // Will contain all locales.
    static $translations; // Wil contain all translations indexed by locale.

    /**
     * Get all locales.
     */
    public static function getLocales()
    {
		$locale_dir = __DIR__.'/locale';
        if(empty(self::$locales))
        {   
            foreach(glob($locale_dir.'/*.json') as $localeFilePath)
            {
                self::$locales[] = pathinfo($localeFilePath, PATHINFO_FILENAME);
            }
        }
    
        return self::$locales;
    }

    /**
     * Get all translations indexed by locale.
     */
    public static function getAllTranslations()
    {
        foreach(self::getLocales() as $locale)
        {
            self::getTranslations($locale);
        }
    
        return self::$translations;
    }

    /**
     * Get translations for a given locale. 
     */
    public static function getTranslations($locale, $section)
    {
		$locale_dir = __DIR__.'/locale';
        if(!self::hasLocale($locale))
        {
            throw new \InvalidArgumentException('Locale "'.$locale.'" does not exist.');
        }
        else if(!isset(self::$translations[$locale]))
        {   
            self::$translations[$locale] = json_decode(file_get_contents($locale_dir.'/'.$locale.'.json'), true);
        }
        return self::$translations[$locale][$section];
    }

    /**
     * Check if a locale exists.
     */
    public static function hasLocale($locale)
    {
        return in_array($locale, self::getLocales());
    }
}
?>