<?php

/**
 * Manage the internationalization of the site.
 *
 * A locale file is a JSON object of sections (one per page, plus 'common'), each
 * mapping keys to strings or to nested blocks of strings. Its values are therefore
 * `mixed` to the type checker: read a single value through block() and string(),
 * which narrow it instead of trusting the shape of the file.
 */
class Intl
{
    const DEFAULT_LOCALE = 'en'; // Default locale

    /** @var list<string>|null All locales, read from the locale directory on first use. */
    private static ?array $locales = null;

    /** @var array<string, array<array-key, mixed>> Decoded locale files, indexed by locale. */
    private static array $translations = [];

    /**
     * Get all locales.
     *
     * @return list<string>
     */
    public static function getLocales(): array
    {
        if (self::$locales === null) {
            $locales = [];
            $paths = glob(__DIR__ . '/locale/*.json');
            foreach ($paths === false ? [] : $paths as $localeFilePath) {
                $locales[] = pathinfo($localeFilePath, PATHINFO_FILENAME);
            }
            self::$locales = $locales;
        }

        return self::$locales;
    }

    /**
     * Get translations for a given locale.
     * Merges 'common' translations with section-specific translations.
     * Section-specific translations take precedence in case of conflicts.
     *
     * @return array<array-key, mixed>
     */
    public static function getTranslations(string $locale, string $section): array
    {
        if (!self::hasLocale($locale)) {
            throw new \InvalidArgumentException('Locale "' . $locale . '" does not exist.');
        }
        $all = self::load($locale);

        // Start with common translations (if section is not 'common'), then let the
        // section-specific ones override them.
        $result = $section !== 'common' ? self::block($all, 'common') : [];

        return array_merge($result, self::block($all, $section));
    }

    /**
     * The nested block under $key, or an empty array when there is none.
     *
     * @param array<array-key, mixed> $translations
     * @return array<array-key, mixed>
     */
    public static function block(array $translations, string $key): array
    {
        return self::asArray($translations[$key] ?? null);
    }

    /**
     * The string under $key, or '' when there is none.
     *
     * @param array<array-key, mixed> $translations
     */
    public static function string(array $translations, string $key): string
    {
        return self::asString($translations[$key] ?? null);
    }

    /**
     * Check if a locale exists.
     */
    public static function hasLocale(mixed $locale): bool
    {
        return in_array($locale, self::getLocales(), true);
    }

    /**
     * The decoded locale file, read once per request.
     *
     * @return array<array-key, mixed>
     */
    private static function load(string $locale): array
    {
        if (!isset(self::$translations[$locale])) {
            $json = file_get_contents(__DIR__ . '/locale/' . $locale . '.json');
            if ($json === false) {
                throw new \RuntimeException('Locale "' . $locale . '" cannot be read.');
            }
            self::$translations[$locale] = self::asArray(json_decode($json, true, 512, JSON_THROW_ON_ERROR));
        }

        return self::$translations[$locale];
    }

    /**
     * @return array<array-key, mixed>
     */
    private static function asArray(mixed $value): array
    {
        return is_array($value) ? $value : [];
    }

    private static function asString(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }
}
