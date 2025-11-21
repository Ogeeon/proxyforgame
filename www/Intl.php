<?php

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