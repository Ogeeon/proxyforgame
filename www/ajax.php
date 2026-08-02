<?php
  // The site's only backend endpoint. Every request names a service; each
  // service lives in its own file under api/ and is a plain function that
  // returns its result or throws an ApiError. Nothing below a handler writes
  // to the output - the three cases here are the whole response protocol.

  require_once 'db.connect.inc.php';
  require_once __DIR__ . '/api/http.inc.php';
  require_once __DIR__ . '/api/mail.inc.php';
  require_once __DIR__ . '/api/changelog.inc.php';
  require_once __DIR__ . '/api/spy-report.inc.php';
  require_once __DIR__ . '/api/server-data.inc.php';
  require_once __DIR__ . '/api/populated-systems.inc.php';

  // Services with a side effect take POST; the rest are reads and take GET.
  $apiRoutes = array(
    'report'           => array('POST', 'apiReport'),
    'email'            => array('POST', 'apiEmail'),
    'changelog'        => array('GET',  'apiChangelog'),
    'ogameAPI'         => array('GET',  'apiSpyReport'),
    'serverdata'       => array('GET',  'apiServerData'),
    'populatedSystems' => array('GET',  'apiPopulatedSystems'),
  );

  try {
      respondJson(200, dispatch($apiRoutes));
  } catch (ApiError $e) {
      respondJson($e->getStatus(), apiErrorBody($e->getErrorCode(), $e->getMessage()));
  } catch (Throwable $e) {
      // Whatever went wrong is ours to read in the log, not the caller's.
      error_log('ajax.php: ' . $e);
      respondJson(500, apiErrorBody('internal_error', 'Internal error'));
  }
