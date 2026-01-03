<?php
session_start();

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

$title = 'feed post';
$description = 'view a single feed post.';

// Resolve post id from path (/feed/posts/{id}) with ?= fallback for old links
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$postFilename = null;
$postIdNoExt = null;

if ($requestPath) {
    $segments = explode('/', trim($requestPath, '/'));
    if (count($segments) >= 3 && $segments[0] === 'feed' && $segments[1] === 'posts' && $segments[2] !== '') {
        $slug = rawurldecode($segments[2]);
        $slug = basename($slug); // strip any nested paths
        $slug = preg_replace('/\.txt$/i', '', $slug); // drop optional extension
        if ($slug !== '') {
            $postIdNoExt = $slug;
            $postFilename = $postIdNoExt . '.txt';
        }
    }
}

// Fallback: legacy ?= links
if ($postFilename === null) {
    $queryString = $_SERVER['QUERY_STRING'] ?? '';
    if (strpos($queryString, '=') === 0) {
        $postIdNoExt = basename(substr($queryString, 1));
        $postFilename = $postIdNoExt . '.txt';
    }
}

if (!$postFilename) {
    header('Location: /feed');
    exit;
}

// Load the post file
$postsDir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'feed';
$postPath = $postsDir . DIRECTORY_SEPARATOR . $postFilename;
if (!file_exists($postPath) || !preg_match('/\.txt$/', $postFilename)) {
    header('Location: /feed');
    exit;
}

$raw = @file_get_contents($postPath);
if ($raw === false) {
    header('Location: /feed');
    exit;
}

// Parse the post
$lines = preg_split("/(\r\n|\n|\r)/", $raw);
$usernameLine = isset($lines[0]) ? trim($lines[0]) : '';
$dateLine = isset($lines[1]) ? trim($lines[1]) : '';
$body = '';
if (count($lines) > 2) {
    $body = implode("\n", array_slice($lines, 2));
}

// Normalize username
$username = ltrim($usernameLine, '@');

// Humanize time difference function (same as in /feed)
$humanize = function($dtStr) {
    try {
        $dt = new DateTime($dtStr);
        $now = new DateTime('now');
        $diff = $now->getTimestamp() - $dt->getTimestamp();
        if ($diff < 60) return $diff . 's ago';
        if ($diff < 3600) return floor($diff / 60) . 'm ago';
        if ($diff < 86400) return floor($diff / 3600) . 'h ago';
        return $dt->format('Y-m-d');
    } catch (Exception $e) {
        return $dtStr;
    }
};

$safeUser = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
$humanizedDate = $humanize($dateLine);
$safeDate = htmlspecialchars($humanizedDate, ENT_QUOTES, 'UTF-8');
$safeBody = htmlspecialchars($body, ENT_QUOTES, 'UTF-8');

// Extract first image from body for og:image metadata
$imageUrl = null;
if (preg_match('/\[img=([^\]\s]+)\]/', $body, $matches)) {
    $imageUrl = $matches[1];
}

// Remove BBCode from description
$plainBody = $body;
$plainBody = preg_replace('/\[img[^\]]*\](?:\[name:[^\]]*\])?/i', '', $plainBody); // Remove images
$plainBody = preg_replace('/\[[^\]]*\][^\[]*\[\/[^\]]*\]/s', '', $plainBody); // Remove other BBCode tags
$plainBody = preg_replace('/\[([a-z]+)[^\]]*\]/i', '', $plainBody); // Remove remaining opening tags
$plainBody = trim($plainBody);
// Limit description to 160 chars for metadata
$shortDescription = substr($plainBody, 0, 160);
if (strlen($plainBody) > 160) {
    $shortDescription .= '...';
}

// Update title and description
$title = 'feed post by @' . $safeUser;
$description = htmlspecialchars($shortDescription, ENT_QUOTES, 'UTF-8');

// Load template
$template_path = find_template_file('template.html');
if (!$template_path) {
    die('template.html not found. report this issue to me@fridg3.org.');
}

$template = file_get_contents($template_path);

// Inject og:image meta tag if post has an image
if ($imageUrl) {
    $ogImageTag = '<meta property="og:image" content="' . htmlspecialchars($imageUrl, ENT_QUOTES, 'UTF-8') . '">';
    $template = str_replace('</head>', $ogImageTag . "\n</head>", $template);
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

// Inject data-post-id on bookmark icon so JS knows which post this is
if ($postIdNoExt !== null) {
    $safePostId = htmlspecialchars($postIdNoExt, ENT_QUOTES, 'UTF-8');
    $content = str_replace('id="post-bookmark-feed"', 'id="post-bookmark-feed" data-post-id="' . $safePostId . '"', $content);
}

// Determine if current user can edit this post
$canEdit = false;
if (isset($_SESSION['user'])) {
    $currentUser = $_SESSION['user']['username'] ?? '';
    $isAdmin = $_SESSION['user']['isAdmin'] ?? false;
    $canEdit = ($currentUser === $username) || $isAdmin;
}

// Build edit icon if allowed
$editIcon = '';
if ($canEdit) {
    $postId = urlencode($postFilename);
    $editIcon = '<span id="post-edit-feed" data-tooltip="edit post"><a href="/feed/edit?post=' . $postId . '" style="color: inherit; text-decoration: none;"><i class="fa-solid fa-pencil"></i></a></span>';
}

// Replace placeholders in content
$content = str_replace('{username}', $safeUser, $content);
$content = str_replace('{content}', $safeBody, $content);

// Add edit button to header if allowed
if ($canEdit) {
    $content = str_replace('{date}', $safeDate . ' • ' . $editIcon, $content);
} else {
    $content = str_replace('{date}', $safeDate, $content);
}

$html = str_replace('{content}', $content, $template);
$html = str_replace('{title}', $title, $html);
$html = str_replace('{description}', $description, $html);
echo $html;
?>
