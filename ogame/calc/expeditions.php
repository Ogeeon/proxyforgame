<?php
    require 'h_abox.php';
    require 'h_functions.php';
    
    require_once('../../langs.php');
    $lang = get_lang();
    $currUrl = '/ogame/calc/expeditions.php';
    
    require_once('../../Intl.php');
    $l = Intl::getTranslations($lang, 'expeditions');

    require_once('expeditions.tpl');
