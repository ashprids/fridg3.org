<?php

session_start();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

if (!isset($_SESSION['user']) || !isset($_SESSION['user']['username'])) {
    // Not logged in; nothing to persist server-side
    echo json_encode(['ok' => false, 'error' => 'not_logged_in']);
    exit;
}

$username = (string)$_SESSION['user']['username'];
$intensity = isset($_POST['glowIntensity']) ? (string)$_POST['glowIntensity'] : '';

$allowed = ['none', 'low', 'medium', 'high'];
if (!in_array($intensity, $allowed, true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_intensity']);
    exit;
}

$accountsPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
if (!is_file($accountsPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'accounts_missing']);
    exit;
}

$raw = @file_get_contents($accountsPath);
$data = json_decode($raw, true);
if (!is_array($data) || !isset($data['accounts']) || !is_array($data['accounts'])) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'accounts_invalid']);
    exit;
}

$updated = false;
foreach ($data['accounts'] as &$account) {
    if (isset($account['username']) && (string)$account['username'] === $username) {
        $account['glowIntensity'] = $intensity;
        $updated = true;
        break;
    }
}
unset($account);

if ($updated) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json !== false) {
        @file_put_contents($accountsPath, $json);
        echo json_encode(['ok' => true]);
        exit;
    }
}

http_response_code(500);
echo json_encode(['ok' => false, 'error' => 'write_failed']);
exit;
