<?php

$sessionBootstrapDir = __DIR__;
while (!file_exists($sessionBootstrapDir . "/lib/session.php") && dirname($sessionBootstrapDir) !== $sessionBootstrapDir) {
    $sessionBootstrapDir = dirname($sessionBootstrapDir);
}
require_once $sessionBootstrapDir . "/lib/session.php";
fridg3_start_session();

$title = 'settings';
$description = 'customize your preferences.';


function find_template_file($filename) {
    $dir = __DIR__;
    $prev_dir = '';
    
    while ($dir !== $prev_dir) {
        $filepath = $dir . DIRECTORY_SEPARATOR . $filename;
        if (file_exists($filepath)) {
            return $filepath;
        }
        $prev_dir = $dir;
        $dir = dirname($dir);
    }
    
    return null;
}

$render_helper_path = find_template_file('lib/render.php');
if ($render_helper_path) {
    require_once $render_helper_path;
}

$template_name = function_exists('get_preferred_template_name')
    ? get_preferred_template_name(__DIR__)
    : 'template.html';
$template_path = find_template_file($template_name);
if (!$template_path && $template_name !== 'template.html') {
    $template_path = find_template_file('template.html');
}
if (!$template_path) {
    die('page template not found. report this issue to me@fridg3.org.');
}

$template = file_get_contents($template_path);
if (function_exists('apply_preferred_theme_stylesheet')) {
    $template = apply_preferred_theme_stylesheet($template, __DIR__);
}

// Generate user greeting if logged in
$user_greeting = '';
if (isset($_SESSION['user'])) {
    $user_name = htmlspecialchars($_SESSION['user']['name'], ENT_QUOTES, 'UTF-8');
    $user_greeting = '<div id="user-greeting">Hello, ' . $user_name . '!</div>';
    
    // Swap Account button to Logout
    $accountBtn = '<a href="/account"><div id="footer-button" data-tooltip="access your fridg3.org account"><i class="fa-solid fa-user"></i></div></a>';
    $logoutBtn = '<a href="/account/logout"><div id="footer-button" data-tooltip="log out"><i class="fa-solid fa-arrow-right-from-bracket"></i></div></a>';
    $template = str_replace($accountBtn, $logoutBtn, $template);
}

// Replace user greeting placeholder
$template = str_replace('{user_greeting}', $user_greeting, $template);

$content_path = find_template_file('content.html');
if (!$content_path) {
    die('content.html not found. report this issue to me@fridg3.org.');
}

$content = file_get_contents($content_path);

$isLoggedIn = isset($_SESSION['user']) && isset($_SESSION['user']['username']);
$isAdmin = isset($_SESSION['user']['isAdmin']) && $_SESSION['user']['isAdmin'] === true;
$hasLinkedDiscord = false;

if ($isLoggedIn) {
    $accountsPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
    if (is_file($accountsPath)) {
        $accountsData = json_decode((string)@file_get_contents($accountsPath), true);
        if (isset($accountsData['accounts']) && is_array($accountsData['accounts'])) {
            $currentUsername = (string)$_SESSION['user']['username'];
            foreach ($accountsData['accounts'] as $account) {
                if (!isset($account['username']) || (string)$account['username'] !== $currentUsername) {
                    continue;
                }
                $hasLinkedDiscord = trim((string)($account['discordUserId'] ?? '')) !== '';
                break;
            }
        }
    }
}

if (!$isLoggedIn) {
    // Hide user-only controls when not logged in
    $content = str_replace('<span id="user-settings">', '<span id="user-settings" style="display:none">', $content);
}
if (!$isAdmin) {
    // Keep markup to avoid layout shifts; hide by default
    $content = str_replace('<span id="admin-settings">', '<span id="admin-settings" style="display:none">', $content);
}
if ($hasLinkedDiscord) {
    $activeDiscordButton = '<button id="form-button" type="button" data-tooltip="save your discord user ID to your account for notifications" onclick="window.location=\'/account/link-discord\'">link discord account</button>';
    $disabledDiscordButton = '<button id="form-button" type="button" class="form-button-disabled" data-tooltip="your discord account is already linked" disabled aria-disabled="true">link discord account</button>';
    $content = str_replace($activeDiscordButton, $disabledDiscordButton, $content);
}
$html = str_replace('{content}', $content, $template);
$html = str_replace('{title}', $title, $html);
$html = str_replace('{description}', $description, $html);
echo $html;
?>
