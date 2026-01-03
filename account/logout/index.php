<?php
// Immediately log out when visiting this page
session_start();

// Clear all session data
$_SESSION = [];

// Delete the session cookie if set
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}

// Clear admin flag cookie
$secureFlag = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
setcookie('is_admin', '', time() - 3600, '/', '', $secureFlag, false);
setcookie('is_admin', '', [
    'expires' => time() - 3600,
    'path' => '/',
    'secure' => $secureFlag,
    'httponly' => false,
    'samesite' => 'Lax'
]);

// Destroy the session
session_destroy();

// Redirect to login page with flash message
header('Location: /account/login?logged_out=1');
exit;
?>
