<?php
// Session-based authentication guard for /admin
// Include this at the top of every admin PHP file.

// Ensure session is started once
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
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
