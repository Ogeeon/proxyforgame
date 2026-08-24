<?php
//
// GitHub webhook receiver. Installed at the document root of
// webhooks.proxyforgame.com; it is the only inbound path from GitHub to a host.
//
// Two events are accepted, and nothing else:
//
//   workflow_run       the normal deploy. Fires when a workflow finishes, so
//                      filtering on conclusion == success is what makes "deploy
//                      only what CI proved" true. A plain `push` subscription
//                      would race the test run instead of waiting for it.
//
//   workflow_dispatch  the rollback lever. This event - unlike workflow_run -
//                      carries the inputs the run was started with, which is
//                      the only way a chosen commit can reach the server
//                      without opening a second endpoint.
//
// The receiver does no git work itself: it validates, then hands a commit to
// deploy/pfg-sync, which the reconcile timer and a human at a shell also use.
// One code path updates a checkout, not three.
//
// Config lives one directory above this file, outside the document root:
//
//   SECRET=<the webhook secret, also set in the GitHub webhook settings>
//   SYNC=/path/to/pfg-sync
//   LOG=/path/to/webhook.log
//

$confPath = getenv('PFG_WEBHOOK_CONF') ?: __DIR__ . '/../pfg-webhook.conf';
$conf = [];
foreach (@file($confPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
    if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
    list($k, $v) = explode('=', $line, 2);
    $conf[trim($k)] = trim($v, " \t\"'");
}

$log = $conf['LOG'] ?? '/dev/null';
function deployLog($message) {
    global $log;
    @file_put_contents($log, date('c') . ' ' . $message . "\n", FILE_APPEND);
}

function respond($status, $message) {
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message . "\n";
    exit;
}

$delivery = $_SERVER['HTTP_X_GITHUB_DELIVERY'] ?? '-';
$event    = $_SERVER['HTTP_X_GITHUB_EVENT'] ?? '';

if (empty($conf['SECRET']) || empty($conf['SYNC'])) {
    deployLog("[$delivery] misconfigured: $confPath lacks SECRET or SYNC");
    respond(500, 'receiver is not configured');
}

// ---------------------------------------------------------------------------
// Authenticate before parsing. hash_equals, not ==, so a wrong signature does
// not leak how much of it was right through timing.
// ---------------------------------------------------------------------------
$body = file_get_contents('php://input');
$given = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$want  = 'sha256=' . hash_hmac('sha256', $body, $conf['SECRET']);
if ($given === '' || !hash_equals($want, $given)) {
    deployLog("[$delivery] REJECTED $event: bad or missing signature");
    respond(401, 'bad signature');
}

if ($event === 'ping') {
    deployLog("[$delivery] ping - receiver is alive");
    respond(200, 'pong');
}

$payload = json_decode($body, true);
if (!is_array($payload)) {
    deployLog("[$delivery] $event: payload is not JSON");
    respond(400, 'malformed payload');
}

// ---------------------------------------------------------------------------
// Decide whether this delivery means "deploy", and to what commit
// ---------------------------------------------------------------------------
$sha = null;
$why = '';

if ($event === 'workflow_run') {
    $run = $payload['workflow_run'] ?? [];
    $checks = [
        'action is completed'   => ($payload['action'] ?? '') === 'completed',
        'workflow is CI'        => ($run['name'] ?? '') === 'CI',
        'branch is main'        => ($run['head_branch'] ?? '') === 'main',
        'triggered by a push'   => ($run['event'] ?? '') === 'push',
        'conclusion is success' => ($run['conclusion'] ?? '') === 'success',
    ];
    $failed = array_keys(array_filter($checks, function ($ok) { return !$ok; }));
    if ($failed) {
        deployLog("[$delivery] workflow_run ignored (" . implode(', ', $failed) . ')');
        respond(202, 'ignored');
    }
    $sha = $run['head_sha'] ?? '';
    $why = 'CI passed on main';

} elseif ($event === 'workflow_dispatch') {
    // Any workflow can be dispatched by hand; only the deploy one may move the
    // server, or a manual run of the Claude workflows would redeploy the site.
    if (substr($payload['workflow'] ?? '', -strlen('/deploy.yml')) !== '/deploy.yml') {
        deployLog("[$delivery] workflow_dispatch ignored (not deploy.yml: " . ($payload['workflow'] ?? '?') . ')');
        respond(202, 'ignored');
    }
    $sha = $payload['inputs']['ref'] ?? '';
    $why = 'manual dispatch';

} else {
    deployLog("[$delivery] $event ignored (not subscribed)");
    respond(202, 'ignored');
}

// A commit id arrives here from the public internet and ends up on a command
// line. Nothing but hex may pass, however well signed the delivery was.
if (!preg_match('/^[0-9a-f]{7,40}$/', (string)$sha)) {
    deployLog("[$delivery] $event REJECTED: '$sha' is not a commit id");
    respond(400, 'not a commit id');
}

// ---------------------------------------------------------------------------
// Hand off, detached.
//
// GitHub gives a webhook ten seconds. A deploy is a fetch, a reset and five
// smoke requests, which can outlast that - and a delivery marked failed would
// then hide a deploy that actually worked. So the response goes back at once
// and the outcome is reported by pfg-sync itself: the log, and mail when the
// site stops serving. The hourly reconcile run is what catches a delivery that
// never arrived at all.
// ---------------------------------------------------------------------------
$cmd = sprintf(
    'nohup %s --sha %s >> %s 2>&1 &',
    escapeshellarg($conf['SYNC']),
    escapeshellarg($sha),
    escapeshellarg($log)
);
deployLog("[$delivery] $event accepted ($why) - syncing to $sha");
exec($cmd);
respond(202, "deploying $sha");
