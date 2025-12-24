<?php
require_once $_SERVER['DOCUMENT_ROOT'] . '/admin/_auth.php';
// Admin unreserve handler: remove a username reservation from
// guestbook/data/name_reservations.json

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

$key = mb_strtolower($name);
$map = read_name_reservations();
if (!isset($map[$key])) {
    echo '<script>alert(' . json_encode("'" . $name . "' is not currently reserved") . '); window.location = "index.html";</script>';
    exit;
}

unset($map[$key]);
$ok = write_name_reservations($map);
if ($ok) {
    echo '<script>alert(' . json_encode("$name has been unreserved") . '); window.location = "index.html";</script>';
} else {
    echo '<script>alert("Failed to update reservations file"); window.location = "index.html";</script>';
}
exit;
