<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method not allowed']);
    exit;
}

$id = isset($_GET['id']) ? trim($_GET['id']) : '';
if ($id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing id']);
    exit;
}

// Sanitize ID to a simple basename without path components
$id = basename($id);

$rootDir = dirname(__DIR__, 2);
$postsDir = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'feed';
$postFile = $postsDir . DIRECTORY_SEPARATOR . $id . '.txt';

if (!is_file($postFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'post not found']);
    exit;
}

$raw = @file_get_contents($postFile);
if ($raw === false) {
    http_response_code(500);
    echo json_encode(['error' => 'failed to read post']);
    exit;
}

$lines = preg_split("/(\r\n|\n|\r)/", $raw);
$usernameLine = isset($lines[0]) ? trim($lines[0]) : '';
$dateLine = isset($lines[1]) ? trim($lines[1]) : '';
$body = '';
if (count($lines) > 2) {
    $body = implode("\n", array_slice($lines, 2));
}

// Normalize username
$username = ltrim($usernameLine, '@');

// Humanize time difference (same as /feed)
$humanize = function($dtStr) {
    try {
        $dt = new DateTime($dtStr);
        $now = new DateTime('now');
        $diff = $now->getTimestamp() - $dt->getTimestamp();
        if ($diff < 60) return $diff . 's ago';
        if ($diff < 3600) return floor($diff / 60) . 'm ago';
        if ($diff < 86400) return floor($diff / 3600) . 'h ago';
        return $dt->format('Y-m-d');
    } catch (Exception $e) {
        return $dtStr;
    }
};

$response = [
    'id' => $id,
    'username' => $username,
    'date_raw' => $dateLine,
    'date_human' => $humanize($dateLine),
    'body' => $body,
];

echo json_encode($response);
