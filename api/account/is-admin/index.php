<?php
// Returns JSON indicating whether the current session user is an admin.
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_samesite', 'Strict');
if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    ini_set('session.cookie_secure', 1);
}

session_start();
header('Content-Type: application/json');

$isAdmin = (isset($_SESSION['user']) && !empty($_SESSION['user']['isAdmin']));
$secureFlag = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
setcookie('is_admin', $isAdmin ? '1' : '0', [
    'expires' => 0,
    'path' => '/',
    'secure' => $secureFlag,
    'httponly' => false,
    'samesite' => 'Lax'
]);

echo json_encode(['isAdmin' => $isAdmin], JSON_UNESCAPED_SLASHES);
?>
