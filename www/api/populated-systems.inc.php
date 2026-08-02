<?php
  // Which systems of a universe hold players, so the flight calculator can skip
  // the empty ones. The table is filled by the get_population.php cron, and
  // plenty of universes simply have no row - that is a 404, not a failure.

  require_once __DIR__ . '/http.inc.php';
  require_once __DIR__ . '/server-data.inc.php';

  function apiPopulatedSystems($in) {
      list($country, $universe) = requireUniverse($in);

      $result = sqlQuery("
          SELECT timestamp, population, population_all, UNIX_TIMESTAMP(updated_at) AS updated_at
          FROM population_data
          WHERE universe = ? AND country = ?
      ", array($universe, $country));

      if ($result === false) {
          throw new ApiError(500, 'internal_error', 'The population_data query could not be run');
      }
      if (count($result) === 0) {
          throw new ApiError(404, 'not_found', "No population data for {$country}-{$universe}");
      }

      $row = $result[0];

      // population_all is null for rows written before the two settings were told
      // apart; the client falls back to skipping nothing rather than guessing.
      return array(
        'timestamp' => (int)$row['timestamp'],
        'updatedAt' => (int)$row['updated_at'],
        'populatedSystems' => json_decode($row['population'], true),
        'populatedSystemsAll' => $row['population_all'] === null
            ? null
            : json_decode($row['population_all'], true)
      );
  }
