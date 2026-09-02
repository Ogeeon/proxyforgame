# Local-development image only - the hosts run Apache + mod_php and CI uses
# shivammathur/setup-php. See docs/adr/0002-docker-local-dev.md.
#
# The base tag must be the same major.minor as .php-version (production's pin,
# ADR-0001). scripts/check-php-version.js warns if the two drift.
FROM php:8.2-cli

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends default-mysql-client libicu-dev libonig-dev; \
    docker-php-ext-install -j"$(nproc)" mysqli intl mbstring; \
    rm -rf /var/lib/apt/lists/*

COPY docker/php/conf.d/pfg.ini /usr/local/etc/php/conf.d/pfg.ini

WORKDIR /repo
EXPOSE 8000

# Drop root: the container only reads the bind-mounted repo and serves it. The
# php image ships this account (uid 33); port 8000 is unprivileged so the
# built-in server needs nothing more. See docs/adr/0002-docker-local-dev.md.
USER www-data

# Byte-identical to `make serve` and to what CI does: the built-in server, no
# router, document root www/. Pretty /en/ URLs (an .htaccess concern) are not
# served here - the tests navigate to *.php directly.
CMD ["php", "-S", "0.0.0.0:8000", "-t", "www"]
