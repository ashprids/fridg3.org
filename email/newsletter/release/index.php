<?php

session_start();

$title = 'newsletter release';
$description = 'view a published newsletter release.';


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

$content_path = find_template_file('content.html');
if (!$content_path) {
    die('content.html not found. report this issue to me@fridg3.org.');
}

$content = file_get_contents($content_path);

$id = '';
if (isset($_GET['id'])) {
    $id = preg_replace('/[^a-zA-Z0-9_-]/', '', trim((string)$_GET['id']));
} elseif (isset($_SERVER['PATH_INFO']) && preg_match('/^\/([a-zA-Z0-9_-]+)$/', $_SERVER['PATH_INFO'], $m)) {
    $id = $m[1];
} else {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if (preg_match('#/email/newsletter/release/([a-zA-Z0-9_-]+)#', $uri, $m)) {
        $id = $m[1];
    }
}

$newsletterTitle = 'newsletter';
$newsletterDate = '';
$newsletterHtml = '<p>newsletter not found.</p>';

if ($id !== '') {
    $rootDir = dirname(__DIR__, 3);
    $newsletterFile = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'newsletter' . DIRECTORY_SEPARATOR . $id . '.html';
    if (is_file($newsletterFile)) {
        $raw = @file_get_contents($newsletterFile);
        if ($raw !== false) {
            $newsletterHtml = $raw;
            $newsletterDate = $id;

            if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $id, $m)) {
                $ts = strtotime($m[1] . '-' . $m[2] . '-' . $m[3]);
                if ($ts !== false) {
                    $newsletterDate = date('F Y', $ts);
                }
            }

            if (preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $raw, $matches)) {
                $candidate = trim(strip_tags($matches[1]));
                if ($candidate !== '') {
                    $newsletterTitle = $candidate;
                }
            } else {
                $newsletterTitle = $id;
            }

            $title = $newsletterTitle;
            $description = 'newsletter release for ' . $newsletterDate . '.';
        }
    }
}

$content = str_replace('{newsletter_title}', htmlspecialchars($newsletterTitle, ENT_QUOTES, 'UTF-8'), $content);
$content = str_replace('{newsletter_date}', htmlspecialchars($newsletterDate, ENT_QUOTES, 'UTF-8'), $content);
$content = str_replace('{newsletter_html}', $newsletterHtml, $content);

$html = str_replace('{content}', $content, $template);
$html = str_replace('{title}', $title, $html);
$html = str_replace('{description}', $description, $html);

// Inject user greeting and swap account button when logged in
$user_greeting = '';
if (isset($_SESSION['user']) && isset($_SESSION['user']['name'])) {
    $user_name = htmlspecialchars($_SESSION['user']['name'], ENT_QUOTES, 'UTF-8');
    $user_greeting = '<div id="user-greeting">Hello, ' . $user_name . '!</div>';
    // Swap Account button to Logout in the template footer
    $accountBtn = '<a href="/account"><div id="footer-button" data-tooltip="access your fridg3.org account"><i class="fa-solid fa-user"></i></div></a>';
    $logoutBtn = '<a href="/account/logout"><div id="footer-button" data-tooltip="log out"><i class="fa-solid fa-right-from-bracket"></i></div></a>';
    $html = str_replace($accountBtn, $logoutBtn, $html);
}
$html = str_replace('{user_greeting}', $user_greeting, $html);
echo $html;
?>
