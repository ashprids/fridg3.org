<?php
// API endpoint to publish a newsletter HTML file

session_start();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$id = isset($_POST['id']) ? trim((string)$_POST['id']) : '';
$html = isset($_POST['html']) ? (string)$_POST['html'] : '';

if ($id === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_id']);
    exit;
}

if ($html === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_html']);
    exit;
}

$sanitizedId = preg_replace('/[^a-zA-Z0-9_-]/', '-', $id);
$sanitizedId = trim($sanitizedId, '-');

if ($sanitizedId === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_id']);
    exit;
}

$rootDir = dirname(__DIR__, 3);
$newsletterDir = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'newsletter';

if (!is_dir($newsletterDir) && !@mkdir($newsletterDir, 0775, true)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mkdir_failed']);
    exit;
}

$fileName = $sanitizedId . '.html';
$filePath = $newsletterDir . DIRECTORY_SEPARATOR . $fileName;

if (@file_put_contents($filePath, $html) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write_failed']);
    exit;
}

echo json_encode([
    'ok' => true,
    'file' => $fileName,
    'path' => 'data/newsletter/' . $fileName,
]);
exit;
