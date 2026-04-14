<?php

$sessionBootstrapDir = __DIR__;
while (!file_exists($sessionBootstrapDir . "/lib/session.php") && dirname($sessionBootstrapDir) !== $sessionBootstrapDir) {
    $sessionBootstrapDir = dirname($sessionBootstrapDir);
}
require_once $sessionBootstrapDir . "/lib/session.php";
fridg3_start_session();

$title = 'newsletters';
$description = 'an archive of previously released newsletters, sent via email.';
$isAdmin = isset($_SESSION['user']['isAdmin']) && $_SESSION['user']['isAdmin'] === true;
$pageSizeDefault = 10;

function render_newsletter_pagination(int $currentPage, int $totalPages, string $searchQuery): string {
    if ($totalPages <= 1) {
        return '';
    }
    $items = '';
    for ($i = 1; $i <= $totalPages; $i++) {
        $isCurrent = $i === $currentPage;
        $class = 'guestbook-page-btn' . ($isCurrent ? ' current' : '');
        $aria = $isCurrent ? ' aria-current="page"' : '';
        $query = $searchQuery !== '' ? '&q=' . urlencode($searchQuery) : '';
        if ($isCurrent) {
            $items .= '<span class="' . $class . '"' . $aria . '>' . $i . '</span>';
        } else {
            $items .= '<a class="' . $class . '" href="/email/newsletter?page=' . $i . $query . '">' . $i . '</a>';
        }
    }
    return '<div class="guestbook-pagination">' . $items . '</div>';
}


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

$content_path = find_template_file('content.html');
if (!$content_path) {
    die('content.html not found. report this issue to me@fridg3.org.');
}

$content = file_get_contents($content_path);
$searchQuery = trim($_GET['q'] ?? '');
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;

$userBookmarks = [];
if (isset($_SESSION['user']) && !empty($_SESSION['user']['username'])) {
    $accountsFile = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
    $username = (string)$_SESSION['user']['username'];
    if (is_file($accountsFile)) {
        $json = @file_get_contents($accountsFile);
        $accountsData = json_decode($json, true);
        if (isset($accountsData['accounts']) && is_array($accountsData['accounts'])) {
            foreach ($accountsData['accounts'] as $account) {
                if (isset($account['username']) && $account['username'] === $username && isset($account['bookmarks']) && is_array($account['bookmarks'])) {
                    $userBookmarks = array_values(array_unique(array_map('strval', $account['bookmarks'])));
                    break;
                }
            }
        }
    }
}

if (!$isAdmin) {
    $content = preg_replace('#<a[^>]*href="/email/newsletter/create"[^>]*>.*?</a>#is', '', $content);
}

// Build newsletter list from /data/newsletter
$posts_dir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'newsletter';
$post_items = '';
$paginationHtml = '';

if (is_dir($posts_dir)) {
    $post_files = glob($posts_dir . DIRECTORY_SEPARATOR . '*.html');
    $posts = [];

    foreach ($post_files as $pf) {
        $filename = basename($pf, '.html');
        $raw = @file_get_contents($pf);
        if ($raw === false) {
            continue;
        }

        $postTitle = $filename;
        if (preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $raw, $matches)) {
            $candidate = trim(strip_tags($matches[1]));
            if ($candidate !== '') {
                $postTitle = $candidate;
            }
        }

        $postDescription = 'newsletter release';
        // Prefer hidden preheader text from newsletter template
        if (preg_match('/<div[^>]*mso-hide:all[^>]*>(.*?)<\/div>/is', $raw, $matches)) {
            $candidate = trim(preg_replace('/\s+/', ' ', strip_tags($matches[1])));
            if ($candidate !== '') {
                $postDescription = html_entity_decode($candidate, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
        } elseif (preg_match('/<p[^>]*>(.*?)<\/p>/is', $raw, $matches)) {
            $candidate = trim(preg_replace('/\s+/', ' ', strip_tags($matches[1])));
            if ($candidate !== '') {
                $postDescription = html_entity_decode($candidate, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
        }

        $displayDate = date('Y-m-d', @filemtime($pf) ?: time());
        $sortTimestamp = @filemtime($pf) ?: 0;
        if (preg_match('/^(\d{4}-\d{2}-\d{2})$/', $filename, $m)) {
            $displayDate = $m[1];
            $parsedTs = strtotime($m[1]);
            if ($parsedTs !== false) {
                $sortTimestamp = $parsedTs;
            }
        }

        $posts[] = [
            'filename' => $filename,
            'date' => $displayDate,
            'title' => $postTitle,
            'description' => $postDescription,
            'timestamp' => $sortTimestamp,
        ];
    }

    if ($searchQuery !== '') {
        $needle = strtolower($searchQuery);
        $posts = array_values(array_filter($posts, function($post) use ($needle) {
            $haystack = strtolower(($post['title'] ?? '') . ' ' . ($post['description'] ?? ''));
            return strpos($haystack, $needle) !== false;
        }));
    }

    usort($posts, function($a, $b) {
        if ($a['timestamp'] === $b['timestamp']) {
            return strcmp($b['filename'], $a['filename']);
        }
        return $b['timestamp'] <=> $a['timestamp'];
    });

    $totalPosts = count($posts);
    $totalPages = max(1, (int)ceil($totalPosts / $pageSizeDefault));
    if ($page > $totalPages) {
        $page = $totalPages;
    }
    $offset = ($page - 1) * $pageSizeDefault;
    $postsPage = array_slice($posts, $offset, $pageSizeDefault);

    foreach ($postsPage as $post) {
        $post_date = htmlspecialchars($post['date'], ENT_QUOTES, 'UTF-8');
        $post_title = htmlspecialchars($post['title'], ENT_QUOTES, 'UTF-8');
        $post_description = htmlspecialchars($post['description'], ENT_QUOTES, 'UTF-8');
        $filename = rawurlencode($post['filename']);
        $bookmarkId = 'newsletter:' . $post['filename'];
        $safeBookmarkId = htmlspecialchars($bookmarkId, ENT_QUOTES, 'UTF-8');
        $bookmarkIconClass = in_array($bookmarkId, $userBookmarks, true) ? 'fa-solid' : 'fa-regular';
        $actionsHtml = '<span id="journal-post-actions" style="position:absolute;top:12px;right:12px;display:inline-flex;align-items:center;gap:8px;">'
            . '<span id="post-bookmark" style="position:static;top:auto;right:auto;" data-tooltip="save post" data-post-id="' . $safeBookmarkId . '"><i class="' . $bookmarkIconClass . ' fa-bookmark"></i></span>'
            . '</span>';

        $item = '<a id="post" class="journal-post-link" href="/email/newsletter/release/' . $filename . '">' 
            . '<span id="post-date">' . $post_date . '</span>'
            . $actionsHtml
            . '<span id="post-title">' . $post_title . '</span>'
            . '<span id="post-description">' . $post_description . '</span>'
            . '</a>';
        $post_items .= $item . "\n";
    }

    $paginationHtml = render_newsletter_pagination($page, $totalPages, $searchQuery);
}

$searchQueryEsc = htmlspecialchars($searchQuery, ENT_QUOTES, 'UTF-8');
$content = preg_replace('#<input id="search-box" name="q" type="text" placeholder="search\.\.\.">#i', '<input id="search-box" name="q" type="text" placeholder="search..." value="' . $searchQueryEsc . '">', $content);
$emptyState = '';
if (trim($post_items) === '') {
    $emptyState = '<p style="margin-top:20px;color:var(--subtle);">there are no posts yet, keep an eye!</p>';
}
$content = preg_replace('/<div id="posts">.*?<\/div>/s', '<div id="posts">' . $post_items . '</div>' . $paginationHtml, $content);
$content .= $emptyState;

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
