<?php
// Admin purge handler: remove all posts by a specified username from the
// guestbook messages file (`guestbook/data/guestbook.json`).

require_once __DIR__ . '/../../../guestbook/_storage.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'Method not allowed';
    exit;
}

$name = trim((string)($_POST['name'] ?? ''));
if ($name === '') {
    echo '<script>alert("No username provided"); window.location = "index.html";</script>';
    exit;
}

// Read existing messages (safe locked read)
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
        if (isset($fp) && is_resource($fp)) { fflush($fp); flock($fp, LOCK_UN); fclose($fp); }
    }
}

$kept = [];
$removed = 0;
$lower = mb_strtolower($name);
foreach ($arr as $entry) {
    if (!is_array($entry)) { $kept[] = $entry; continue; }
    $ename = isset($entry['name']) ? mb_strtolower((string)$entry['name']) : '';
    if ($ename !== '' && $ename === $lower) {
        $removed++;
        continue;
    }
    $kept[] = $entry;
}

// Write back the filtered array atomically
$dir = dirname($messagesFile);
if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
$tmpFile = tempnam($dir, 'gbpur');
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

if ($ok) {
    $msg = ($removed > 0) ? "$name posts removed: $removed" : "$name had no posts to remove";
} else {
    $msg = "Failed to update guestbook file";
}

echo '<script>alert(' . json_encode($msg) . '); window.location = "index.html";</script>';
exit;
