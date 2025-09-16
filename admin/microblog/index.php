<?php
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $text = trim($_POST["text"]);
    if (!$text) die("empty post?");

    $timestamp = date("Y-m-d_H-i-s");
    $posts_dir = __DIR__ . '/../../microblog/posts';
    $images_dir = __DIR__ . '/../../microblog/images';
    if (!is_dir($posts_dir)) mkdir($posts_dir, 0775, true);
    if (!is_dir($images_dir)) mkdir($images_dir, 0775, true);
    $posts_dir = realpath($posts_dir);
    $images_dir = realpath($images_dir);
    $filename = $posts_dir . "/$timestamp.txt";
    $content = "fridge\n" . date("d/m/y H:i") . "\n" . $_POST["text"];

    // handle image upload
    if (isset($_FILES["image"]) && $_FILES["image"]["error"] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES["image"]["name"], PATHINFO_EXTENSION);
        $img_name = "$timestamp.$ext";
        $target = $images_dir . "/$img_name";

        move_uploaded_file($_FILES["image"]["tmp_name"], $target);

        // add image filename as 4th line in post file
        $content .= "\n[IMAGE:$img_name]";
    }

    file_put_contents($filename, $content);

    // Load Discord webhook from /admin/webhooks.env
    $env_path = __DIR__ . '/../webhooks.env';
    if (file_exists($env_path)) {
        $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0 || trim($line) === '') continue;
            list($name, $value) = array_map('trim', explode('=', $line, 2));
            $value = trim($value, '"');
            putenv("$name=$value");
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
<button id="change-theme"><i class="fas fa-sun"></i></button>
    <center>
    <h1><a href="/index.html">fridge</a></h1>
    <a href="/blog">blog</a>
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

