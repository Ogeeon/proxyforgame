<?php
  // Which systems of a universe hold players, so the flight calculator can skip
  // the empty ones. The table is filled by the get_population.php cron.

  require_once __DIR__ . '/http.inc.php';

  function getPopulatedSystems() {
      $country = getVar('country', 'str');
      $universe = getVar('universe', 'int');
      $result = sqlQuery("
          SELECT timestamp, population, population_all, UNIX_TIMESTAMP(updated_at) AS updated_at
          FROM population_data
          WHERE universe = ? AND country = ?
      ", array($universe, $country));

      // population_all is null for rows written before the two settings were told
      // apart; the client falls back to skipping nothing rather than guessing.
      header('Content-Type: application/json');
      echo json_encode([
        'timestamp' => (int)$result[0]['timestamp'],
        'updatedAt' => (int)$result[0]['updated_at'],
        'populatedSystems' => json_decode($result[0]['population'], true),
        'populatedSystemsAll' => $result[0]['population_all'] === null
            ? null
            : json_decode($result[0]['population_all'], true)
    ]);
  }
