<?php
  // all ajax services are handled here
  // the request must always contain the service parameter
  // Each service lives in its own file under api/; this one only routes.

  header('Content-Type: text/html; charset=utf-8');
  require_once 'db.connect.inc.php';
  require_once __DIR__ . '/api/http.inc.php';
  require_once __DIR__ . '/api/mail.inc.php';
  require_once __DIR__ . '/api/changelog.inc.php';
  require_once __DIR__ . '/api/spy-report.inc.php';
  require_once __DIR__ . '/api/server-data.inc.php';
  require_once __DIR__ . '/api/populated-systems.inc.php';

  // if it's unclear what kind of request this is, do nothing and exit with an error
  if (!isset($_REQUEST['service'])) {
    die("1\nno service");
  }
  $service = $_REQUEST['service'];

  switch ($service)
  {
    case 'report': sendReport(); break;
    case 'email': sendEmail(); break;
    case 'changelog': getChangelog(); break;
    case 'ogameAPI': getDataCode(); break;
    case 'serverdata': apiServerData(); break;
    case 'populatedSystems': getPopulatedSystems(); break;

    // for all other "unknown" services exit with code 2
    default: die("2\nunknown");
  }
