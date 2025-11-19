<?php
// Simple admin ban/unban handler.
// This file expects a POST with 'name' (username or IP). It will add or remove
// an entry in guestbook/data/bans.json. After completion it shows a JS alert
// and redirects back to index.html.

// Load storage helpers
require_once __DIR__ . '/../../../guestbook/_storage.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'Method not allowed';
    exit;
}

$input = trim((string)($_POST['name'] ?? ''));
if ($input === '') {
    echo '<script>alert("No input provided"); window.location = "index.html";</script>';
    exit;
}

$isIp = filter_var($input, FILTER_VALIDATE_IP) !== false;
$name = '';
$ip = '';

if ($isIp) {
    $ip = $input;
    // try to find an associated reserved name for this IP
    $assoc = get_reserved_name_for_ip($ip);
    if ($assoc) $name = $assoc;
} else {
    // treat as username: find any reservation mapping or recent message IP
    $name = $input;
    // Try reservations first
    $map = read_name_reservations();
    $key = mb_strtolower($name);
    if (isset($map[$key]) && isset($map[$key]['ip_hash'])) {
        $ip = (string)$map[$key]['ip_hash'];
    } else {
        // fallback: look through recent messages to find a matching name
        $msgs = read_messages(200);
        foreach ($msgs as $m) {
            if (!is_array($m)) continue;
            if (isset($m['name']) && mb_strtolower((string)$m['name']) === $key) {
                $ip = isset($m['ip_hash']) ? (string)$m['ip_hash'] : '';
                break;
            }
        }
    }
}

// Normalize empty values
if (!is_string($name)) $name = '';
if (!is_string($ip)) $ip = '';

$bans = read_bans();
$found = false;
$new = [];
foreach ($bans as $b) {
    if (!is_array($b)) continue;
    $bn = isset($b['name']) ? mb_strtolower((string)$b['name']) : '';
    $bp = isset($b['ip']) ? (string)$b['ip'] : '';
    $skip = false;
    // If input specified a name and it matches this entry, remove it
    if ($name !== '' && $bn === mb_strtolower($name)) $skip = true;
    // If input specified an IP and it matches this entry (using ip_matches for compatibility), remove it
    if ($ip !== '' && ip_matches($bp, $ip)) $skip = true;
    if ($skip) { $found = true; continue; }
    $new[] = $b;
}

if ($found) {
    // we removed matching bans -> write back (unban)
    write_bans($new);
    $action = 'unbanned';
} else {
    // add a new ban entry
    $ok = add_ban($name, $ip);
    $action = 'banned';
}

$dispName = $name !== '' ? $name : '(unknown)';
$dispIp = $ip !== '' ? $ip : '(unknown)';

// Show alert and redirect back
echo '<script>alert(' . json_encode("$dispName ($dispIp) has been $action.") . '); window.location = "index.html";</script>';
exit;
