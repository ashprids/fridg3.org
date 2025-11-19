<?php
// Delete a single guestbook message by id. Expects JSON POST { id: <number|string> }
// Returns JSON { ok: true, removed: 1 } or { ok: false, error: '...' }

require_once __DIR__ . '/../../../guestbook/_storage.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = [];
if ($raw !== false && $raw !== '') {
    $tmp = json_decode($raw, true);
    if (is_array($tmp)) $data = $tmp;
}

// support form-encoded fallback
if (empty($data) && isset($_POST['id'])) {
    $data['id'] = $_POST['id'];
}

$id = isset($data['id']) ? (string)$data['id'] : '';
if ($id === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'No id provided']);
    exit;
}

global $messagesFile;
$arr = [];
if (file_exists($messagesFile)) {
    $fp = @fopen($messagesFile, 'c+');
    if ($fp) {
        if (flock($fp, LOCK_EX)) {
            rewind($fp);
            $contents = stream_get_contents($fp);
            $tmp = json_decode($contents, true);
            if (is_array($tmp)) $arr = $tmp;
        }
        // we'll rewrite via temp+rename, release after
        if (isset($fp) && is_resource($fp)) { fflush($fp); flock($fp, LOCK_UN); fclose($fp); }
    }
}

$kept = [];
$removed = 0;
foreach ($arr as $entry) {
    if (!is_array($entry)) { $kept[] = $entry; continue; }
    if (isset($entry['id']) && (string)$entry['id'] === (string)$id) {
        $removed++;
        continue;
    }
    $kept[] = $entry;
}

if ($removed === 0) {
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'No matching post']);
    exit;
}

$dir = dirname($messagesFile);
if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
$tmpFile = tempnam($dir, 'gbdel');
$ok = false;
if ($tmpFile !== false) {
    $w = @file_put_contents($tmpFile, json_encode($kept, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($w !== false) {
        $renamed = @rename($tmpFile, $messagesFile);
        if (!$renamed) {
            $copied = @copy($tmpFile, $messagesFile);
            if ($copied) @unlink($tmpFile);
            $renamed = $copied;
        }
        $ok = $renamed;
    } else {
        @unlink($tmpFile);
    }
}

header('Content-Type: application/json');
if ($ok) {
    echo json_encode(['ok' => true, 'removed' => $removed]);
    exit;
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to update guestbook file']);
    exit;
}

?>
