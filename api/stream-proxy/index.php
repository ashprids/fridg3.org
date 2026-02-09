<?php
// Simple same-origin stream proxy to avoid mixed-content issues for toast listen-along
set_time_limit(0);
ignore_user_abort(true);

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate');

function find_template_file($filename) {
    $dir = __DIR__;
    $prev_dir = '';
    while ($dir !== $prev_dir) {
        $filepath = $dir . DIRECTORY_SEPARATOR . $filename;
        if (file_exists($filepath)) return $filepath;
        $prev_dir = $dir;
        $dir = dirname($dir);
    }
    return null;
}

// Load toast configuration to know the expected stream host
$config_path = find_template_file('data' . DIRECTORY_SEPARATOR . 'etc' . DIRECTORY_SEPARATOR . 'toast.json');
if (!$config_path) {
    http_response_code(500);
    echo 'config not found';
    exit;
}

$config = json_decode(file_get_contents($config_path), true);
$baseUrl = isset($config['stream']['url']) ? trim($config['stream']['url']) : '';
if ($baseUrl === '') {
    http_response_code(500);
    echo 'stream url missing';
    exit;
}

$target = isset($_GET['u']) ? trim($_GET['u']) : $baseUrl;

// Validate target: only allow http/https and same host as configured stream
function normalize_url($url) {
    if (!$url) return null;
    $url = trim($url);
    if (!preg_match('#^[a-zA-Z][a-zA-Z0-9+.-]*://#', $url)) {
        $url = 'http://' . $url;
    }
    return $url;
}

$baseNorm = normalize_url($baseUrl);
$targetNorm = normalize_url($target);

if (!$baseNorm || !$targetNorm) {
    http_response_code(400);
    echo 'invalid url';
    exit;
}

$baseParts = parse_url($baseNorm);
$targetParts = parse_url($targetNorm);

if (!isset($targetParts['scheme']) || !in_array(strtolower($targetParts['scheme']), ['http', 'https'])) {
    http_response_code(400);
    echo 'unsupported scheme';
    exit;
}

if (!isset($baseParts['host'], $targetParts['host']) || strtolower($baseParts['host']) !== strtolower($targetParts['host'])) {
    http_response_code(403);
    echo 'forbidden host';
    exit;
}

$targetUrl = $targetNorm;

$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "Icy-MetaData: 1\r\nUser-Agent: fridg3.org-stream-proxy\r\n",
        'timeout' => 15,
    ],
    'ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true,
    ],
]);

$stream = @fopen($targetUrl, 'rb', false, $context);
if (!$stream) {
    http_response_code(502);
    echo 'unable to fetch stream';
    exit;
}

$meta = stream_get_meta_data($stream);
$contentType = 'audio/mpeg';
if (!empty($meta['wrapper_data']) && is_array($meta['wrapper_data'])) {
    foreach ($meta['wrapper_data'] as $headerLine) {
        if (stripos($headerLine, 'Content-Type:') === 0) {
            $contentType = trim(substr($headerLine, strlen('Content-Type:')));
            break;
        }
    }
}
header('Content-Type: ' . $contentType);

while (!feof($stream)) {
    $chunk = fread($stream, 8192);
    if ($chunk === false) break;
    echo $chunk;
    if (function_exists('fastcgi_finish_request')) {
        // no-op: we want to keep streaming
    }
    if (connection_aborted()) break;
    flush();
}

fclose($stream);
exit;
