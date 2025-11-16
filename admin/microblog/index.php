<?php

// get the authenticated username (try common server variables)
$user = $_SERVER['REMOTE_USER'] ?? $_SERVER['PHP_AUTH_USER'] ?? '';

// Some FastCGI deployments don't populate those; try Authorization header if needed:
if (!$user && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
    if (preg_match('/Basic\s+(.*)$/i', $_SERVER['HTTP_AUTHORIZATION'], $m)) {
        $creds = base64_decode($m[1]);
        if ($creds !== false) {
            list($u,) = explode(':', $creds, 2);
            $user = $u;
        }
    }
}
// safe display
$displayUser = htmlspecialchars($user, ENT_QUOTES, 'UTF-8');

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    try {
        $text = trim($_POST["text"]);
    // author name supplied by form (defaults to 'fridge')
    $author = trim($_POST["name"] ?? "");
    if ($author === "") $author = $displayUser;

    if (!$text) die("empty post?");

    $timestamp = date("Y-m-d_H-i-s");
    $posts_dir = __DIR__ . '/../../microblog/posts';
    $images_dir = __DIR__ . '/../../microblog/images';
    if (!is_dir($posts_dir)) mkdir($posts_dir, 0775, true);
    if (!is_dir($images_dir)) mkdir($images_dir, 0775, true);
    $posts_dir = realpath($posts_dir);
    $images_dir = realpath($images_dir);
    // realpath can return false if something went wrong; fall back to expected paths
    if ($posts_dir === false) $posts_dir = __DIR__ . '/../../microblog/posts';
    if ($images_dir === false) $images_dir = __DIR__ . '/../../microblog/images';
    $filename = $posts_dir . "/$timestamp.txt";
    $content = $author . "\n" . date("d/m/y H:i") . "\n" . $_POST["text"];

    // handle image upload
    if (isset($_FILES["image"]) && $_FILES["image"]["error"] === UPLOAD_ERR_OK) {
        $tmpPath = $_FILES["image"]["tmp_name"];
        // try to read image info
        $info = @getimagesize($tmpPath);
        if ($info !== false) {
            list($width, $height, $type) = $info;

            // create image resource from uploaded file
            $src = null;
            switch ($type) {
                case IMAGETYPE_JPEG:
                    $src = @imagecreatefromjpeg($tmpPath);
                    break;
                case IMAGETYPE_PNG:
                    $src = @imagecreatefrompng($tmpPath);
                    break;
                case IMAGETYPE_GIF:
                    $src = @imagecreatefromgif($tmpPath);
                    break;
                case IMAGETYPE_WEBP:
                    if (function_exists('imagecreatefromwebp')) {
                        $src = @imagecreatefromwebp($tmpPath);
                    }
                    break;
            }

            if ($src !== null) {
                // optional: fix orientation for JPEGs if EXIF data exists
                if ($type === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
                    $exif = @exif_read_data($tmpPath);
                    if (!empty($exif['Orientation'])) {
                        switch ($exif['Orientation']) {
                            case 3: $src = imagerotate($src, 180, 0); break;
                            case 6: $src = imagerotate($src, -90, 0); break;
                            case 8: $src = imagerotate($src, 90, 0); break;
                        }
                        // update width/height after rotation
                        $width = imagesx($src);
                        $height = imagesy($src);
                    }
                }

                // compute new size preserving aspect ratio with max dimension 1000px
                $maxDim = 1000;
                $scale = 1.0;
                if ($width > $maxDim || $height > $maxDim) {
                    $scale = $maxDim / max($width, $height);
                }
                $newW = max(1, (int) round($width * $scale));
                $newH = max(1, (int) round($height * $scale));

                $dst = imagecreatetruecolor($newW, $newH);
                // fill with white to avoid black background for transparent PNG/GIF
                $white = imagecolorallocate($dst, 255, 255, 255);
                imagefill($dst, 0, 0, $white);

                imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $width, $height);

                $img_name = "$timestamp.jpg";
                $target = $images_dir . "/$img_name";
                // quality 85 for decent compression
                $saved = @imagejpeg($dst, $target, 85);

                imagedestroy($src);
                imagedestroy($dst);

                // verify the saved file exists and is non-empty; if not, attempt fallback
                if ($saved && file_exists($target) && filesize($target) > 0) {
                    // good
                } else {
                    // fallback: try moving the original uploaded temp file
                    if (@move_uploaded_file($tmpPath, $target)) {
                        // moved original file
                    } else {
                        // last resort: try copy
                        @copy($tmpPath, $target);
                    }
                }

                // add image filename as 4th line in post file
                $content .= "\n[IMAGE:$img_name]";
            } else {
                // unsupported image type or failed to load - fallback to moving the file
                $ext = pathinfo($_FILES["image"]["name"], PATHINFO_EXTENSION);
                $img_name = "$timestamp." . ($ext ?: 'img');
                $target = $images_dir . "/$img_name";
                @move_uploaded_file($tmpPath, $target);
                $content .= "\n[IMAGE:$img_name]";
            }
        } else {
            // not an image or failed to read - move as-is (best-effort)
            $ext = pathinfo($_FILES["image"]["name"], PATHINFO_EXTENSION);
            $img_name = "$timestamp." . ($ext ?: 'img');
            $target = $images_dir . "/$img_name";
            @move_uploaded_file($tmpPath, $target);
            $content .= "\n[IMAGE:$img_name]";
        }
    }

    file_put_contents($filename, $content);

    // Load Discord webhook from /admin/webhooks.env
    $env_path = __DIR__ . '/../webhooks.env';
    if (file_exists($env_path)) {
        $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0 || trim($line) === '') continue;
            list($envKey, $value) = array_map('trim', explode('=', $line, 2));
            $value = trim($value, '"');
            putenv("$envKey=$value");
        }
    }
    $webhook_url = getenv('MICROBLOG_WEBHOOK');
    $post_link = "https://fridg3.org/microblog/post.php?id=$timestamp";
    $message = "**New microblog post! <@&1408064770891972660>**\nRead here: $post_link";

    if (isset($_FILES['image'])) { var_export($_FILES['image']); exit; } else { echo 'no image in $_FILES'; } 
    $payload = json_encode(["content" => $message]);
    $ch = curl_init($webhook_url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $result = curl_exec($ch);
    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

        if ($httpcode == 204) {
            header("Location: success.php?post_url=" . urlencode($post_link));
            exit;
        } else {
            header("Location: success.php?post_url=" . urlencode($post_link) . "&webhook_failed=1");
            exit;
        }
    } catch (Throwable $e) {
        // Temporary debugging output - remove when finished
        http_response_code(500);
        ini_set('display_errors', '1');
        ini_set('display_startup_errors', '1');
        error_reporting(E_ALL);
        echo '<h2>Server error (debug)</h2>';
        echo '<pre>' . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . "\n\n" . htmlspecialchars($e->getTraceAsString(), ENT_QUOTES, 'UTF-8') . '</pre>';
        exit;
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="/style.css">
    <link rel="icon" type="image/x-icon" href="/resources/favicon.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <title>fridge | post to microblog</title>
    <meta name="description" content="Create a /microblog/ post">
</head>
<body>
<div class="container">
<script src="/theme.js"></script>
<button id="change-theme"><i class="fa-solid fa-palette"></i></button>
    <center>
    <h1><a href="/">fridge</a></h1>
    <a href="/microblog">[micro]</a><a href="/blog">blog</a>
    <a href="/about">about</a>
    <a href="/contact">contact</a>
    <a href="/projects">projects</a>
    <a href="/music">music</a>
</center>
<br><br>
<h3>Upload a Post</h3>
<br>
<center>
    <form method="post" enctype="multipart/form-data" class="contact-form">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" value="<?php echo $displayUser; ?>"><br><br>
        <label for="text">Post contents</label>
        <textarea id="text" name="text" rows="5" placeholder="Full HTML syntax is supported" required></textarea>
        
        <label for="image">Image (optional)</label>
        <input type="file" name="image" id="image">
        
        <button type="submit">post</button>
    </form>
</center>
</div>
</body>
</html>

