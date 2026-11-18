<?php

declare(strict_types=1);

/**
 * A locale that is listed but whose file cannot be read. The page cannot be
 * rendered without its strings, so nothing catches it on the way up.
 */
class LocaleUnavailableException extends RuntimeException
{
}
