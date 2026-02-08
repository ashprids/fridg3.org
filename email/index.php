<?php

session_start();

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

// Generate a server-side math security question and store the answer in session
try {
    $a = random_int(0, 12);
    $b = random_int(0, 12);
    $ops = ['+', '-', '*'];
    $op = $ops[array_rand($ops)];
    switch ($op) {
        case '+':
            $correct = $a + $b;
            break;
        case '-':
            $correct = $a - $b;
            break;
        case '*':
        default:
            $correct = $a * $b;
            break;
    }
    $_SESSION['email_security_answer'] = $correct;
    $questionHtml = '<h5 id="security-question">what is ' . $a . ' ' . $op . ' ' . $b . '?</h5>';
    if (isset($_GET['error']) && $_GET['error'] === '1') {
        $questionHtml .= '<div style="color:#cf6c6c; margin-top:4px;">invalid security answer, try again.</div>';
    }
    $content = str_replace('{security_question_html}', $questionHtml, $content);
} catch (Exception $e) {
    // If random_int fails for any reason, fall back to a static message
    $content = str_replace('{security_question_html}', '<h5 id="security-question">security question failed to load, please refresh the page.</h5>', $content);
}

// Populate old form inputs when redirected back after an error
$old_name = '';
$old_email = '';
$old_message = '';
if (!empty($_SESSION['email_old_input']) && is_array($_SESSION['email_old_input'])) {
    $old = $_SESSION['email_old_input'];
    $old_name = isset($old['name']) ? htmlspecialchars($old['name'], ENT_QUOTES, 'UTF-8') : '';
    $old_email = isset($old['email']) ? htmlspecialchars($old['email'], ENT_QUOTES, 'UTF-8') : '';
    $old_message = isset($old['message']) ? htmlspecialchars($old['message'], ENT_QUOTES, 'UTF-8') : '';
    // clear after reading so it doesn't persist
    unset($_SESSION['email_old_input']);
}

$content = str_replace('{old_name}', $old_name, $content);
$content = str_replace('{old_email}', $old_email, $content);
$content = str_replace('{old_message}', $old_message, $content);

// Show success message after a successful FormSubmit redirect
$statusMessage = '';
if (isset($_GET['sent']) && $_GET['sent'] === '1') {
    $statusMessage = '<span style="color:#6ccf6c;">email sent!</span><br><br>';
}
if ($statusMessage !== '') {
    $content = preg_replace('/<\/pre><br>\s*/', '</pre><br>' . $statusMessage, $content, 1);
}
$html = str_replace('{content}', $content, $template);
$html = str_replace('{title}', $title, $html);
$html = str_replace('{description}', $description, $html);
echo $html;
?>
