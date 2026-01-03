<?php
session_start();

$title = 'account';
$description = 'view your account details if you are logged in.';


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

// If logged in, redirect to homepage
if (isset($_SESSION['user'])) {
    header('Location: /');
    exit;
}

// If not logged in, redirect to login
if (!isset($_SESSION['user'])) {
    header('Location: /account/login');
    exit;
}

$content_path = find_template_file('content.html');
if (!$content_path) {
    die('content.html not found. report this issue to me@fridg3.org.');
}

$content = file_get_contents($content_path);

// Inject user info into content if placeholders exist
if (isset($_SESSION['user'])) {
    $user = $_SESSION['user'];
    $replacements = [
        '{username}' => htmlspecialchars($user['username'] ?? '', ENT_QUOTES, 'UTF-8'),
        '{name}' => htmlspecialchars($user['name'] ?? '', ENT_QUOTES, 'UTF-8'),
        '{isAdmin}' => !empty($user['isAdmin']) ? 'yes' : 'no',
    ];
    $content = str_replace(array_keys($replacements), array_values($replacements), $content);
}

$html = str_replace('{content}', $content, $template);
$html = str_replace('{title}', $title, $html);
$html = str_replace('{description}', $description, $html);
echo $html;
?>
