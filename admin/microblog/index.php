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

    // handle image upload: simply move uploaded file to images directory without compression
    if (isset($_FILES["image"]) && $_FILES["image"]["error"] === UPLOAD_ERR_OK) {
        $tmpPath = $_FILES["image"]["tmp_name"];
        $origName = $_FILES["image"]["name"];
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        if ($ext === '') $ext = 'img';
        $img_name = "$timestamp." . $ext;
        $target = $images_dir . "/$img_name";
        // move uploaded file; fallback to copy if move fails
        if (!@move_uploaded_file($tmpPath, $target)) {
            @copy($tmpPath, $target);
        }
        $content .= "\n[IMAGE:$img_name]";
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

<script>
// Client-side image resize & compression before upload
document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector('.contact-form');
    const fileInput = document.getElementById('image');

    if (!form || !fileInput) return;

    form.addEventListener('submit', function (e) {
        const file = fileInput.files[0];
        if (!file) return; // no file, allow normal submit

        // Only process image files
        if (!file.type.startsWith('image/')) return;

        e.preventDefault();

        const MAX_DIM = 1000; // max px for width or height
        const MAX_BYTES = 1048576; // 1MB target

        const reader = new FileReader();
        reader.onload = function (ev) {
            const img = new Image();
            img.onload = function () {
                let {width, height} = img;
                let scale = 1;
                if (width > MAX_DIM || height > MAX_DIM) {
                    scale = MAX_DIM / Math.max(width, height);
                }
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(width * scale));
                canvas.height = Math.max(1, Math.round(height * scale));
                const ctx = canvas.getContext('2d');
                // fill white to avoid transparent backgrounds turning black in JPEG
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // iterative quality reduction
                let quality = 0.85;
                const minQuality = 0.5;

                function toBlobPromise(q) {
                    return new Promise(function (res) {
                        canvas.toBlob(function (blob) { res(blob); }, 'image/jpeg', q);
                    });
                }

                (async function tryCompress() {
                    let blob = await toBlobPromise(quality);
                    while (blob && blob.size > MAX_BYTES && quality > minQuality) {
                        quality = Math.max(minQuality, quality - 0.05);
                        blob = await toBlobPromise(quality);
                    }

                    // Build FormData and submit via fetch
                    const fd = new FormData();
                    // include all other form fields
                    for (const el of form.elements) {
                        if (!el.name) continue;
                        if (el === fileInput) continue; // we'll append processed blob
                        if (el.type === 'checkbox' || el.type === 'radio') {
                            if (!el.checked) continue;
                        }
                        if (el.tagName === 'SELECT') {
                            fd.append(el.name, el.value);
                        } else if (el.type === 'file') {
                            // skip
                        } else {
                            fd.append(el.name, el.value);
                        }
                    }

                    // create filename from original but ensure .jpg
                    const origName = file.name || 'image';
                    const base = origName.replace(/\.[^.]+$/, '');
                    const filename = base + '.jpg';
                    fd.append('image', blob, filename);

                    try {
                        const resp = await fetch(window.location.href, {
                            method: 'POST',
                            body: fd,
                            credentials: 'same-origin'
                        });
                        // If server redirected, resp.url will be final URL
                        if (resp.redirected && resp.url) {
                            window.location.href = resp.url;
                        } else {
                            // Fallback: try to read response text for redirect anchor
                            const text = await resp.text();
                            const m = text.match(/success.php\?post_url=[^"'<>\s]+/);
                            if (m) {
                                window.location.href = m[0];
                            } else {
                                // as last resort, reload
                                window.location.reload();
                            }
                        }
                    } catch (err) {
                        alert('Upload failed: ' + err.message);
                    }
                })();
            };
            img.onerror = function () { alert('Failed to load image for processing. Uploading original.'); form.submit(); };
            img.src = ev.target.result;
        };
        reader.onerror = function () { alert('Failed to read file. Uploading original.'); form.submit(); };
        reader.readAsDataURL(file);
    });
});
</script>

</body>
</html>

