<?php

session_start();

// Require logged-in user with permission to create posts
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['username'])) {
    header('Location: /account/login');
    exit;
}

// Check if user is admin or has "feed" in allowedPages
$isAdmin = $_SESSION['user']['isAdmin'] ?? false;
$allowedPages = $_SESSION['user']['allowedPages'] ?? [];
$canCreatePost = $isAdmin || in_array('feed', $allowedPages);

if (!$canCreatePost) {
    header('Location: /feed');
    exit;
}

$title = 'create feed post';
$description = 'create a new post for the feed.';

// Compress to JPEG under the provided byte limit; always flattens transparency to white
function save_jpeg_under_limit(string $srcPath, string $mime, string $destPath, int $maxBytes = 1000000): bool {
    if (!function_exists('imagecreatetruecolor')) {
        return false;
    }

    $createMap = [
        'image/png' => function($p) { return @imagecreatefrompng($p); },
        'image/jpeg' => function($p) { return @imagecreatefromjpeg($p); },
        'image/gif' => function($p) { return function_exists('imagecreatefromgif') ? @imagecreatefromgif($p) : false; },
        'image/webp' => function($p) { return function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($p) : false; },
    ];

    if (!isset($createMap[$mime])) {
        return false;
    }

    $img = $createMap[$mime]($srcPath);
    if (!$img) {
        return false;
    }

    $width = imagesx($img);
    $height = imagesy($img);
    $canvas = imagecreatetruecolor($width, $height);
    $white = imagecolorallocate($canvas, 255, 255, 255);
    imagefill($canvas, 0, 0, $white);
    imagecopy($canvas, $img, 0, 0, 0, 0, $width, $height);
    imagedestroy($img);

    $tmpPath = tempnam(sys_get_temp_dir(), 'img');
    if ($tmpPath === false) {
        imagedestroy($canvas);
        return false;
    }

    $quality = 90;
    do {
        imagejpeg($canvas, $tmpPath, $quality);
        $size = @filesize($tmpPath);
        if ($size !== false && $size <= $maxBytes) {
            break;
        }
        $quality -= 5;
    } while ($quality >= 40);

    imagedestroy($canvas);
    $finalSize = @filesize($tmpPath);
    if ($finalSize === false || $finalSize > $maxBytes) {
        @unlink($tmpPath);
        return false;
    }

    $moved = @rename($tmpPath, $destPath);
    if (!$moved) {
        @unlink($tmpPath);
    }
    return $moved;
}

// Handle create-post submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Require logged-in user
    if (!isset($_SESSION['user']) || !isset($_SESSION['user']['username'])) {
        header('Location: /account/login');
        exit;
    }

    $username = $_SESSION['user']['username'];
    $content = trim($_POST['content'] ?? '');

    // Prepare directories
    $postsDir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'feed'; // /data/feed
    $imagesDir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'images'; // /data/images
    if (!is_dir($postsDir)) {
        @mkdir($postsDir, 0777, true);
    }
    if (!is_dir($imagesDir)) {
        @mkdir($imagesDir, 0777, true);
    }

    // Timestamp for filename and display
    $timestampFilename = date('Y-m-d_H-i-s');
    $displayDateTime = date('Y-m-d H:i:s');

    // Save uploaded images (support multiple) with compression
    $imageMap = [];
    if (isset($_FILES['images']) && isset($_FILES['images']['name']) && is_array($_FILES['images']['name'])) {
        $count = count($_FILES['images']['name']);
        $allowed = [
            'image/png' => 'png',
            'image/jpeg' => 'jpg',
            'image/gif' => 'gif',
            'image/webp' => 'webp'
        ];

        for ($i = 0; $i < $count; $i++) {
            $error = $_FILES['images']['error'][$i] ?? UPLOAD_ERR_NO_FILE;
            if ($error !== UPLOAD_ERR_OK) continue;

            $tmpPath = $_FILES['images']['tmp_name'][$i];
            $origName = $_FILES['images']['name'][$i] ?? ('image_' . $i);
            $imageInfo = @getimagesize($tmpPath);
            $mime = is_array($imageInfo) && isset($imageInfo['mime']) ? $imageInfo['mime'] : '';
            if (!isset($allowed[$mime])) continue;

            $ext = $allowed[$mime];
            $sizeBytes = @filesize($tmpPath) ?: 0;
            $mustJpeg = ($mime === 'image/png');
            $mustCompress = $mustJpeg || ($sizeBytes > 1000000);
            $randomBase = bin2hex(random_bytes(8));
            $destExt = $mustCompress ? 'jpg' : $ext;
            $destName = $randomBase . '.' . $destExt;
            $destPath = $imagesDir . DIRECTORY_SEPARATOR . $destName;

            $saved = false;
            if ($mustCompress) {
                $saved = save_jpeg_under_limit($tmpPath, $mime, $destPath, 1000000);
            } else {
                $saved = @move_uploaded_file($tmpPath, $destPath);
            }

            // Fallback: try compressing to JPEG if initial move failed or size still too large
            $finalSize = $saved ? (@filesize($destPath) ?: 0) : 0;
            if (!$saved || $finalSize > 1000000) {
                @unlink($destPath);
                $destExt = 'jpg';
                $destName = $randomBase . '.jpg';
                $destPath = $imagesDir . DIRECTORY_SEPARATOR . $destName;
                $saved = save_jpeg_under_limit($tmpPath, $mime, $destPath, 1000000);
            }

            if ($saved) {
                $imageMap[$i] = [
                    'url' => '/data/images/' . $destName,
                    'name' => $origName ?: $destName,
                ];
            }
        }
    }

    // Build post file content
    $safeContent = $content; // store raw; renderer can sanitize/format later
    // Replace client-side image placeholders [img:index][name:...] with saved server paths
    if (!empty($imageMap)) {
        $safeContent = preg_replace_callback('/\[img:(\d+)\](?:\[name:([^\]]*)\])?/i', function($m) use ($imageMap) {
            $idx = (int)$m[1];
            if (!isset($imageMap[$idx])) {
                return $m[0];
            }
            $name = isset($m[2]) && strlen(trim($m[2])) ? trim($m[2]) : ($imageMap[$idx]['name'] ?? 'image');
            return '[img=' . $imageMap[$idx]['url'] . '][name:' . $name . ']';
        }, $safeContent);
    }
    $text = '@' . $username . PHP_EOL . $displayDateTime . PHP_EOL . $safeContent . PHP_EOL;
    $postFile = $postsDir . DIRECTORY_SEPARATOR . $timestampFilename . '.txt';
    file_put_contents($postFile, $text);

    // Redirect to feed after posting
    header('Location: /feed');
    exit;
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
