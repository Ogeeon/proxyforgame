<?php
// The hostnames the public site answers on. What only makes sense for real
// visitors - the cookie notice and the Yandex Metrica counter - renders there
// and nowhere else, so local development, CI and the e2e suite run without it.

const PFG_PUBLIC_HOSTS = array('proxyforgame.com', 'proxyforgame.net');

function isPublicHost() {
    return in_array($_SERVER['HTTP_HOST'] ?? '', PFG_PUBLIC_HOSTS, true);
}
