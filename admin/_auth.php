<?php
// Session-based authentication guard for /admin
// Include this at the top of every admin PHP file.

// Configure session to last 30 days
$thirtyDaysInSeconds = 30 * 24 * 60 * 60; // 2592000 seconds
ini_set('session.gc_maxlifetime', $thirtyDaysInSeconds);
ini_set('session.cookie_lifetime', $thirtyDaysInSeconds);

// Ensure session is started once
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

// Check if session has expired (30 days since login)
if (!empty($_SESSION['admin_logged_in']) && !empty($_SESSION['admin_login_time'])) {
    if (time() - $_SESSION['admin_login_time'] > $thirtyDaysInSeconds) {
        // Session expired, destroy and redirect to login
        session_destroy();
        $current = $_SERVER['REQUEST_URI'] ?? '/admin/';
        $target = '/admin/login/?redirect=' . urlencode($current);
        header('Location: ' . $target);
        exit;
    }
}

// If not logged in, send to /login with redirect back to original URL
if (empty($_SESSION['admin_logged_in'])) {
    $current = $_SERVER['REQUEST_URI'] ?? '/admin/';
    $target = '/admin/login/?redirect=' . urlencode($current);
    header('Location: ' . $target);
    exit;
}

// Make username available to pages
if (!isset($_SESSION['admin_user'])) {
    $_SESSION['admin_user'] = '';
}
