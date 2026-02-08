<?php
// Simple stream proxy and playlist resolver to avoid CORS/mixed-content issues.

set_time_limit(0);

function normalize_url($url) {
    if (!$url) return null;
    $url = trim($url);
    if ($url === '') return null;
    if (preg_match('/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//', $url)) return $url;
    if (strpos($url, '//') === 0) return 'http:' . $url;
    return 'http://' . $url;
}

function fetch_url($url, $timeout = 8) {
    $ctx = stream_context_create([
        'http' => [
            'timeout' => $timeout,
            'follow_location' => 1,
            'header' => "User-Agent: fridg3-stream-proxy\r\n"
        ]
    ]);

    $contents = @file_get_contents($url, false, $ctx);
    if ($contents !== false) return $contents;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_USERAGENT, 'fridg3-stream-proxy');
        $out = curl_exec($ch);
        curl_close($ch);
        if ($out !== false) return $out;
    }

    return false;
}

function resolve_playlist($url) {
    $base = normalize_url($url);
    if (!$base) return null;

    $is_pls = preg_match('/\.pls$/i', $base);
    $is_m3u = preg_match('/\.m3u8?$/i', $base);
    if (!$is_pls && !$is_m3u) return $base;

    $contents = fetch_url($base, 8);
    if ($contents === false) return $base;

    if ($is_pls) {
        if (preg_match('/File\d+\s*=\s*(.+)/i', $contents, $m) && isset($m[1])) {
            return normalize_url(trim($m[1]));
        }
        return $base;
    }

    // m3u: first non-comment line
    $lines = preg_split('/\r?\n/', $contents);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        return normalize_url($line);
    }

    return $base;
}

$raw = $_GET['url'] ?? '';
$mode_resolve = isset($_GET['resolve']) && $_GET['resolve'] === '1';

if ($mode_resolve) {
    header('Content-Type: application/json');
    $resolved = resolve_playlist($raw);
    echo json_encode([
        'resolved' => $resolved,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$target = resolve_playlist($raw);
if (!$target) {
    http_response_code(400);
    echo 'Missing or invalid url';
    exit;
}

// Open remote stream
// Try fopen first
$ctx = stream_context_create([
    'http' => [
        'timeout' => 10,
        'follow_location' => 1,
        'header' => "User-Agent: fridg3-stream-proxy\r\n"
    ]
]);

$fp = @fopen($target, 'rb', false, $ctx);
if ($fp) {
    // Try to forward content-type if available
    $meta = stream_get_meta_data($fp);
    $content_type = 'audio/mpeg';
    if (!empty($meta['wrapper_data']) && is_array($meta['wrapper_data'])) {
        foreach ($meta['wrapper_data'] as $header) {
            if (stripos($header, 'Content-Type:') === 0) {
                $content_type = trim(substr($header, strlen('Content-Type:')));
                break;
            }
        }
    }

    header('Content-Type: ' . $content_type);
    header('Cache-Control: no-cache');

    while (!feof($fp)) {
        echo fread($fp, 8192);
        @ob_flush();
        flush();
    }

    fclose($fp);
    exit;
}

// Fallback to cURL streaming if fopen failed (e.g. allow_url_fopen disabled)
if (function_exists('curl_init')) {
    header('Content-Type: audio/mpeg');
    header('Cache-Control: no-cache');

    $ch = curl_init($target);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 0);
    curl_setopt($ch, CURLOPT_USERAGENT, 'fridg3-stream-proxy');
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) {
        echo $data;
        @ob_flush();
        flush();
        return strlen($data);
    });

    $ok = curl_exec($ch);
    curl_close($ch);
    if ($ok !== false) {
        exit;
    }
}

http_response_code(502);
echo 'Failed to open stream';
?>