<?php

session_start();

require_once __DIR__ . DIRECTORY_SEPARATOR . 'email_guard.php';

$title = 'email';
$description = 'send me an email.';


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

$template_path = find_template_file('template.html');
if (!$template_path) {
    die('template.html not found. report this issue to me@fridg3.org.');
}

$template = file_get_contents($template_path);

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

if (!email_contact_ensure_data_dir()) {
    die('could not prepare email data storage. report this issue to me@fridg3.org.');
}

$visitor = email_contact_get_visitor_context();
$submissionsState = email_contact_load_json(email_contact_submissions_path(), []);
$blacklistState = email_contact_load_json(email_contact_blacklist_path(), []);
$accessState = email_contact_get_access_state($visitor, $submissionsState, $blacklistState);

$statusMessage = '';
if (isset($_GET['sent']) && $_GET['sent'] === '1') {
    $statusMessage = '<div class="form-status success">email sent!</div>';
} elseif ($accessState['is_blacklisted'] || (isset($_GET['blacklisted']) && $_GET['blacklisted'] === '1')) {
    $statusMessage = '<div class="form-status error">this IP has been blacklisted from the email form.</div>';
} elseif ($accessState['is_on_cooldown']) {
    $remaining = email_contact_format_countdown((int)$accessState['cooldown_remaining']);
    $statusMessage = '<div class="form-status error">you can send another email in <strong>' . htmlspecialchars($remaining, ENT_QUOTES, 'UTF-8') . '</strong>.</div>';
} elseif (isset($_GET['cooldown']) && $_GET['cooldown'] === '1') {
    $statusMessage = '<div class="form-status error">please wait before trying to send another email.</div>';
} elseif (isset($_GET['error']) && $_GET['error'] === 'validation') {
    $statusMessage = '<div class="form-status error">please fill out the form with a valid email address before sending.</div>';
} elseif (isset($_GET['error']) && $_GET['error'] === 'send') {
    $statusMessage = '<div class="form-status error">the email could not be sent right now. please try again later.</div>';
} elseif (isset($_GET['error']) && $_GET['error'] === 'storage') {
    $statusMessage = '<div class="form-status error">the email form is temporarily unavailable. please try again later.</div>';
}

$submitButtonAttrs = 'data-tooltip="send the above content as an email to me@fridg3.org"';
$submitButtonLabel = 'send';

if ($accessState['is_blacklisted']) {
    $submitButtonAttrs = 'disabled aria-disabled="true" class="form-button-disabled" data-email-blacklisted="1" data-tooltip="this IP has been permanently blocked from using the email form"';
    $submitButtonLabel = 'blacklisted';
} elseif ($accessState['is_on_cooldown']) {
    $submitButtonAttrs = 'disabled aria-disabled="true" class="form-button-disabled" data-email-cooldown="' . (int)$accessState['cooldown_remaining'] . '" data-email-default-label="send" data-tooltip="you can only send one email every 7 days"';
    $submitButtonLabel = email_contact_format_countdown((int)$accessState['cooldown_remaining']);
}

$content = str_replace('{status}', $statusMessage, $content);
$content = str_replace('{submit_button_attrs}', $submitButtonAttrs, $content);
$content = str_replace('{submit_button_label}', htmlspecialchars($submitButtonLabel, ENT_QUOTES, 'UTF-8'), $content);

$html = str_replace('{content}', $content, $template);
$html = str_replace('{title}', $title, $html);
$html = str_replace('{description}', $description, $html);
echo $html;
?>
