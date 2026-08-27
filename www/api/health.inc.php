<?php
  // What someone outside the host can learn about it: which commit is deployed
  // and when each cron job last finished. The watchdog workflow polls this on
  // both hosts and decides what is stale; this service only reports.
  //
  // It deliberately touches neither the database nor the deployed application
  // code. A health check that needs the database cannot report that the
  // database is what broke - and `populatedSystems` already covers that side,
  // since the watchdog fetches it too.

  require_once __DIR__ . '/http.inc.php';

  // Takes no parameter: dispatch() hands every handler the query array, and
  // this service reports the same thing however it is asked.
  function apiHealth() {
      return array(
        'time'   => gmdate('Y-m-d\TH:i:s\Z'),
        'commit' => healthDeployedCommit(dirname(__DIR__, 2)),
        // Cast so an empty result encodes as {} and not as [] - the watchdog
        // indexes this by job name.
        'jobs'   => (object)healthJobStamps(getenv('JOB_STAMP_DIR'))
      );
  }

  /**
   * The commit the checkout is on, read straight out of .git rather than by
   * shelling out to git - the web user has no business running commands, and
   * .git sits one level above the document root where it can still be read.
   *
   * Returns NULL when there is no readable checkout, which is the normal
   * answer under `make serve` from a tarball or in a test fixture.
   */
  function healthDeployedCommit($root) {
      $git = $root . '/.git';
      $head = @file_get_contents($git . '/HEAD');
      if ($head === false) {
          return null;
      }
      $head = trim($head);

      // Detached HEAD - the SHA is in the file itself.
      if (strpos($head, 'ref: ') !== 0) {
          return preg_match('/^[0-9a-f]{40}$/', $head) === 1 ? $head : null;
      }

      return healthResolveRef($git, substr($head, 5));
  }

  /**
   * A ref is normally a file of its own, but git packs refs away as it goes,
   * and then only packed-refs knows where the branch points.
   */
  function healthResolveRef($git, $ref) {
      $loose = @file_get_contents($git . '/' . $ref);
      if ($loose !== false && preg_match('/^[0-9a-f]{40}/', trim($loose), $m) === 1) {
          return $m[0];
      }

      $sha = null;
      $packed = @file($git . '/packed-refs', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
      if ($packed !== false) {
          foreach ($packed as $line) {
              if (preg_match('/^([0-9a-f]{40}) (.+)$/', $line, $m) === 1 && $m[2] === $ref) {
                  $sha = $m[1];
                  break;
              }
          }
      }
      return $sha;
  }

  /**
   * One entry per stamp file left behind by deploy/pfg-cron-run, with the age
   * worked out here so a caller never has to trust its own clock against ours.
   *
   * An empty result means no job has ever reported - which is itself the
   * finding the watchdog is looking for, so it is not an error here.
   */
  function healthJobStamps($dir) {
      $jobs = array();
      if (!is_string($dir) || $dir === '' || !is_dir($dir)) {
          return $jobs;
      }

      $files = glob(rtrim($dir, '/\\') . '/*.json');
      if ($files === false) {
          return $jobs;
      }

      foreach ($files as $file) {
          $raw = @file_get_contents($file);
          if ($raw === false) {
              continue;
          }
          $stamp = json_decode($raw, true);
          if (!is_array($stamp) || !isset($stamp['job'], $stamp['finished'])) {
              continue;
          }
          $finished = strtotime($stamp['finished']);
          if ($finished === false) {
              continue;
          }
          $jobs[(string)$stamp['job']] = array(
            'finished'   => gmdate('Y-m-d\TH:i:s\Z', $finished),
            'ageSeconds' => max(0, time() - $finished),
            'status'     => isset($stamp['status']) ? (int)$stamp['status'] : null
          );
      }

      ksort($jobs);
      return $jobs;
  }
