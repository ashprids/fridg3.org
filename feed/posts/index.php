<?php
$sessionBootstrapDir = __DIR__;
while (!file_exists($sessionBootstrapDir . "/lib/session.php") && dirname($sessionBootstrapDir) !== $sessionBootstrapDir) {
    $sessionBootstrapDir = dirname($sessionBootstrapDir);
}
require_once $sessionBootstrapDir . "/lib/session.php";
fridg3_start_session();
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'lib' . DIRECTORY_SEPARATOR . 'feed.php';
fridg3_feed_refresh_session_user();

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
$replyError = '';
$replySuccess = false;
$replyEditError = '';
$replyEditTargetId = trim((string)($_GET['edit_reply'] ?? $_POST['reply_id'] ?? ''));

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
$postsDir = fridg3_feed_posts_dir();
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

if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_SESSION['user']) || !isset($_SESSION['user']['username'])) {
        header('Location: /account/login');
        exit;
    }

    $submittedToken = (string)($_POST['csrf_token'] ?? '');
    $replyBody = trim((string)($_POST['reply_content'] ?? ''));
    $replyAction = (string)($_POST['reply_action'] ?? 'create');
    $replyId = trim((string)($_POST['reply_id'] ?? ''));
    $imageMap = [];
    if (isset($_FILES['images']) && is_array($_FILES['images'])) {
        $imageMap = fridg3_feed_process_uploaded_images($_FILES['images']);
        $replyBody = fridg3_feed_replace_image_placeholders($replyBody, $imageMap);
    }
    $canModerateReplies = fridg3_feed_current_user_can_moderate_replies($username);
    $targetReply = null;
    foreach (fridg3_feed_load_replies((string)$postIdNoExt) as $existingReply) {
        if (($existingReply['id'] ?? '') === $replyId) {
            $targetReply = $existingReply;
            break;
        }
    }
    $canManageTargetReply = $targetReply !== null
        && fridg3_feed_current_user_can_manage_reply($username, (string)($targetReply['username'] ?? ''));

    if (!hash_equals((string)$_SESSION['csrf_token'], $submittedToken)) {
        $replyError = 'invalid request. try again.';
    } elseif ($replyAction === 'delete') {
        if (!$canManageTargetReply) {
            $replyEditError = 'you do not have permission to delete replies.';
        } elseif ($replyId === '' || !fridg3_feed_delete_reply((string)$postIdNoExt, $replyId)) {
            $replyEditError = 'failed to delete reply.';
        } else {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            header('Location: /feed/posts/' . rawurlencode((string)$postIdNoExt) . '?reply_deleted=1');
            exit;
        }
    } elseif ($replyAction === 'update') {
        if (!$canManageTargetReply) {
            $replyEditError = 'you do not have permission to edit replies.';
        } elseif ($replyBody === '') {
            $replyEditError = 'reply cannot be empty.';
        } elseif (strlen($replyBody) > 4000) {
            $replyEditError = 'reply is too long.';
        } elseif ($replyId === '' || !fridg3_feed_update_reply((string)$postIdNoExt, $replyId, $replyBody)) {
            $replyEditError = 'failed to update reply.';
        } else {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            header('Location: /feed/posts/' . rawurlencode((string)$postIdNoExt) . '?reply_updated=1');
            exit;
        }
    } elseif ($replyBody === '') {
        $replyError = 'reply cannot be empty.';
    } elseif (strlen($replyBody) > 4000) {
        $replyError = 'reply is too long.';
    } elseif (!fridg3_feed_save_reply($postIdNoExt ?? '', (string)$_SESSION['user']['username'], $replyBody)) {
        $replyError = 'failed to save reply.';
    } else {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        header('Location: /feed/posts/' . rawurlencode((string)$postIdNoExt) . '?reply_posted=1');
        exit;
    }
}

$safeUser = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
$humanizedDate = fridg3_feed_humanize_datetime($dateLine);
$safeDate = htmlspecialchars($humanizedDate, ENT_QUOTES, 'UTF-8');
$safeBody = htmlspecialchars($body, ENT_QUOTES, 'UTF-8');
$replySuccess = isset($_GET['reply_posted']) && $_GET['reply_posted'] === '1';
$replyUpdated = isset($_GET['reply_updated']) && $_GET['reply_updated'] === '1';
$replyDeleted = isset($_GET['reply_deleted']) && $_GET['reply_deleted'] === '1';
$replyFormValue = isset($_POST['reply_content']) ? htmlspecialchars((string)$_POST['reply_content'], ENT_QUOTES, 'UTF-8') : '';
$replies = fridg3_feed_load_replies((string)$postIdNoExt);
$canModerateReplies = fridg3_feed_current_user_can_moderate_replies($username);
$editReplyBodyValue = '';
if ($replyEditTargetId !== '' && isset($_POST['reply_action']) && (string)$_POST['reply_action'] === 'update') {
    $editReplyBodyValue = (string)($_POST['reply_content'] ?? '');
}

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

$bookmarkIcon = '<span id="post-bookmark-feed" data-tooltip="save post"><i class="fa-regular fa-bookmark"></i></span>';
$postMeta = $safeDate . ' • ';
if ($editIcon !== '') {
    $postMeta .= $editIcon . ' ';
}
$postMeta .= $bookmarkIcon;

// Replace placeholders in content
$content = str_replace('{username}', $safeUser, $content);
$content = str_replace('{content}', $safeBody, $content);
$content = str_replace('{post_meta}', $postMeta, $content);
$content = str_replace('{reply_form_value}', $replyFormValue, $content);
$content = str_replace('{reply_csrf_token}', htmlspecialchars((string)$_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8'), $content);

$replyNotice = '';
if ($replySuccess) {
    $replyNotice = '<div class="feed-reply-notice success">reply posted.</div>';
} elseif ($replyUpdated) {
    $replyNotice = '<div class="feed-reply-notice success">reply updated.</div>';
} elseif ($replyDeleted) {
    $replyNotice = '<div class="feed-reply-notice success">reply deleted.</div>';
} elseif ($replyError !== '') {
    $replyNotice = '<div class="feed-reply-notice error">' . htmlspecialchars($replyError, ENT_QUOTES, 'UTF-8') . '</div>';
}

$replyEditNotice = '';
if ($replyEditError !== '') {
    $replyEditNotice = '<div class="feed-reply-notice error">' . htmlspecialchars($replyEditError, ENT_QUOTES, 'UTF-8') . '</div>';
}

$replyFormHtml = '';
if (isset($_SESSION['user']) && isset($_SESSION['user']['username'])) {
    $replyFormHtml = '<form id="feed-reply-form" method="POST" enctype="multipart/form-data" action="/feed/posts/' . rawurlencode((string)$postIdNoExt) . '">'
        . '<input type="hidden" name="csrf_token" value="' . htmlspecialchars((string)$_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') . '">'
        . '<div class="bbcode-editor">'
        . '<div class="bbcode-toolbar">'
        . '<button type="button" class="bbcode-btn" data-tag="b" data-tooltip="bold"><i class="fa-solid fa-bold"></i></button>'
        . '<button type="button" class="bbcode-btn" data-tag="i" data-tooltip="italic"><i class="fa-solid fa-italic"></i></button>'
        . '<button type="button" class="bbcode-btn" data-tag="u" data-tooltip="underline"><i class="fa-solid fa-underline"></i></button>'
        . '<button type="button" class="bbcode-btn" data-tag="s" data-tooltip="strikethrough"><i class="fa-solid fa-strikethrough"></i></button>'
        . '<button type="button" id="bbcode-spoiler-btn" class="bbcode-btn" data-tooltip="spoiler"><i class="fa-solid fa-eye-slash"></i></button>'
        . '<button type="button" id="bbcode-color-btn" class="bbcode-btn" data-tooltip="color"><i class="fa-solid fa-palette"></i></button>'
        . '<input id="bbcode-color-input" type="color" style="display: none;">'
        . '<label for="bbcode-image-input">'
        . '<button type="button" id="bbcode-image-btn" class="bbcode-btn" data-tooltip="attach image"><i class="fa-solid fa-image"></i></button>'
        . '</label>'
        . '<input id="bbcode-image-input" name="images[]" type="file" accept="image/*" multiple style="display: none;">'
        . '<button type="button" class="bbcode-btn" data-tag="code=python" data-tooltip="code block"><i class="fa-solid fa-code"></i></button>'
        . '<button type="button" id="bbcode-list-btn" class="bbcode-btn" data-tag="list" data-tooltip="list"><i class="fa-solid fa-list-ul"></i></button>'
        . '<button type="button" id="bbcode-tooltip-btn" class="bbcode-btn" data-tooltip="tooltip"><i class="fa-solid fa-comment-dots"></i></button>'
        . '<button type="button" id="bbcode-link-btn" class="bbcode-btn" data-tooltip="link"><i class="fa-solid fa-link"></i></button>'
        . '<select id="bbcode-header-dropdown" class="bbcode-dropdown" data-tooltip="heading">'
        . '<option value="">headings</option>'
        . '<option value="h3">heading</option>'
        . '<option value="h4">sub-heading</option>'
        . '<option value="h5">caption</option>'
        . '</select>'
        . '<button type="button" id="bbcode-preview-toggle" class="bbcode-btn" data-tooltip="toggle preview"><i class="fa-solid fa-eye"></i></button>'
        . '</div>'
        . '<textarea id="bbcode-textbox" class="feed-reply-textbox" name="reply_content" placeholder="write a reply..." maxlength="4000">{reply_form_value}</textarea>'
        . '<div id="bbcode-preview" style="display: none;"></div>'
        . '</div>'
        . '<button id="form-button" type="submit">reply</button>'
        . '</form>';
}

$repliesHtml = '';
foreach ($replies as $reply) {
    $replyUser = htmlspecialchars((string)$reply['username'], ENT_QUOTES, 'UTF-8');
    $replyDate = htmlspecialchars(fridg3_feed_humanize_datetime((string)$reply['date']), ENT_QUOTES, 'UTF-8');
    $replyBody = htmlspecialchars((string)$reply['body'], ENT_QUOTES, 'UTF-8');
    $replyId = (string)($reply['id'] ?? '');
    $canManageThisReply = fridg3_feed_current_user_can_manage_reply($username, (string)$reply['username']);
    $isEditingReply = $canManageThisReply && $replyEditTargetId !== '' && $replyId === $replyEditTargetId;
    $replyActionsHtml = '';
    if ($canManageThisReply && $replyId !== '') {
        $replyActionsHtml = '<span class="feed-reply-actions">'
            . '<a class="feed-reply-action-link" href="/feed/posts/' . rawurlencode((string)$postIdNoExt) . '?edit_reply=' . rawurlencode($replyId) . '"><i class="fa-solid fa-pencil"></i></a>'
            . '<form class="feed-reply-delete-form" method="post" action="/feed/posts/' . rawurlencode((string)$postIdNoExt) . '">'
            . '<input type="hidden" name="csrf_token" value="' . htmlspecialchars((string)$_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') . '">'
            . '<input type="hidden" name="reply_action" value="delete">'
            . '<input type="hidden" name="reply_id" value="' . htmlspecialchars($replyId, ENT_QUOTES, 'UTF-8') . '">'
            . '<button type="submit" class="feed-reply-action-button" data-tooltip="delete reply"><i class="fa-solid fa-trash"></i></button>'
            . '</form>'
            . '</span>';
    }

    $replyEditFormHtml = '';
    if ($isEditingReply) {
        $currentEditValue = $editReplyBodyValue !== '' ? $editReplyBodyValue : (string)$reply['body'];
        $replyEditFormHtml = '<div class="feed-reply-box feed-reply-edit-box">';
        if ($replyEditNotice !== '') {
            $replyEditFormHtml .= $replyEditNotice;
        }
        $replyEditFormHtml .= '<form method="post" enctype="multipart/form-data" action="/feed/posts/' . rawurlencode((string)$postIdNoExt) . '">'
            . '<input type="hidden" name="csrf_token" value="' . htmlspecialchars((string)$_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') . '">'
            . '<input type="hidden" name="reply_action" value="update">'
            . '<input type="hidden" name="reply_id" value="' . htmlspecialchars($replyId, ENT_QUOTES, 'UTF-8') . '">'
            . '<div class="bbcode-editor">'
            . '<div class="bbcode-toolbar">'
            . '<button type="button" class="bbcode-btn" data-tag="b" data-tooltip="bold"><i class="fa-solid fa-bold"></i></button>'
            . '<button type="button" class="bbcode-btn" data-tag="i" data-tooltip="italic"><i class="fa-solid fa-italic"></i></button>'
            . '<button type="button" class="bbcode-btn" data-tag="u" data-tooltip="underline"><i class="fa-solid fa-underline"></i></button>'
            . '<button type="button" class="bbcode-btn" data-tag="s" data-tooltip="strikethrough"><i class="fa-solid fa-strikethrough"></i></button>'
            . '<button type="button" id="bbcode-spoiler-btn" class="bbcode-btn" data-tooltip="spoiler"><i class="fa-solid fa-eye-slash"></i></button>'
            . '<button type="button" id="bbcode-color-btn" class="bbcode-btn" data-tooltip="color"><i class="fa-solid fa-palette"></i></button>'
            . '<input id="bbcode-color-input" type="color" style="display: none;">'
            . '<label for="bbcode-image-input">'
            . '<button type="button" id="bbcode-image-btn" class="bbcode-btn" data-tooltip="attach image"><i class="fa-solid fa-image"></i></button>'
            . '</label>'
            . '<input id="bbcode-image-input" name="images[]" type="file" accept="image/*" multiple style="display: none;">'
            . '<button type="button" class="bbcode-btn" data-tag="code=python" data-tooltip="code block"><i class="fa-solid fa-code"></i></button>'
            . '<button type="button" id="bbcode-list-btn" class="bbcode-btn" data-tag="list" data-tooltip="list"><i class="fa-solid fa-list-ul"></i></button>'
            . '<button type="button" id="bbcode-tooltip-btn" class="bbcode-btn" data-tooltip="tooltip"><i class="fa-solid fa-comment-dots"></i></button>'
            . '<button type="button" id="bbcode-link-btn" class="bbcode-btn" data-tooltip="link"><i class="fa-solid fa-link"></i></button>'
            . '<select id="bbcode-header-dropdown" class="bbcode-dropdown" data-tooltip="heading">'
            . '<option value="">headings</option>'
            . '<option value="h3">heading</option>'
            . '<option value="h4">sub-heading</option>'
            . '<option value="h5">caption</option>'
            . '</select>'
            . '<button type="button" id="bbcode-preview-toggle" class="bbcode-btn" data-tooltip="toggle preview"><i class="fa-solid fa-eye"></i></button>'
            . '</div>'
            . '<textarea id="bbcode-textbox" class="feed-reply-textbox" name="reply_content" maxlength="4000">' . htmlspecialchars($currentEditValue, ENT_QUOTES, 'UTF-8') . '</textarea>'
            . '<div id="bbcode-preview" style="display: none;"></div>'
            . '</div>'
            . '<button id="form-button" type="submit">save reply</button>'
            . '</form>'
            . '</div>';
    }
    $repliesHtml .= '<div class="feed-reply">'
        . '<div class="feed-reply-header">'
        . '<span class="feed-reply-username">@' . $replyUser . '</span>'
        . '<span class="feed-reply-date">' . $replyDate . $replyActionsHtml . '</span>'
        . '</div>'
        . '<div class="post-content feed-reply-body">' . $replyBody . '</div>'
        . $replyEditFormHtml
        . '</div>';
}
$repliesSectionHtml = '';
if ($repliesHtml !== '') {
    $repliesSectionHtml = '<div class="feed-replies-shell">'
        . '<h2>comments</h2>'
        . '<div class="feed-replies-list">' . $repliesHtml . '</div>'
        . '</div>'
        . '<br>';
}
$content = str_replace('{replies_section}', $repliesSectionHtml, $content);

$replyBoxHtml = '';
if ($replyFormHtml !== '' && $replyEditTargetId === '') {
    $replyBoxHtml = '<div class="feed-reply-box">';
    if ($replyNotice !== '') {
        $replyBoxHtml .= $replyNotice;
    }
    $replyBoxHtml .= $replyFormHtml . '</div>';
} elseif ($replyEditTargetId === '' && $replyNotice !== '') {
    $replyBoxHtml = '<div class="feed-reply-box">' . $replyNotice . '</div>';
}
$content = str_replace('{reply_box}', $replyBoxHtml, $content);
if ($replyFormValue !== '') {
    $content = str_replace('{reply_form_value}', $replyFormValue, $content);
} else {
    $content = str_replace('{reply_form_value}', '', $content);
}

// Add edit button to header if allowed
$html = str_replace('{content}', $content, $template);
$html = str_replace('{title}', $title, $html);
$html = str_replace('{description}', $description, $html);
echo $html;
?>
