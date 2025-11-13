<?php
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $name = trim($_POST["name"] ?? "");
    $desc = trim($_POST["desc"] ?? "");
    $url = trim($_POST["url"] ?? "");
    if (!$name || !$desc || !$url) die("All fields required.");

    // Load Discord webhook from webhooks.env
    $env_path = __DIR__ . '/../../webhooks.env';
    if (file_exists($env_path)) {
        $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0 || trim($line) === '') continue;
            list($name, $value) = array_map('trim', explode('=', $line, 2));
            $value = trim($value, '"');
            putenv("$name=$value");
        }
    }
    $webhook_url = getenv('MUSIC_WEBHOOK');
    $message = "**<@&1408065205518336030>\n$name**\n$desc\nListen here: $url";

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
    header("Location: success.php" . urlencode($post_link));
    exit;
}}
?>

<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="/style.css">
    <link rel="icon" type="image/x-icon" href="/resources/favicon.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <title>fridge | post to #music</title>
    <meta name="description" content="Authorized Access Only">
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
<h3>#music</h3>
<br>
<center>
    <form method="post" class="contact-form">
        <label for="name">Release Name</label>
        <input type="text" id="name" name="name" placeholder="Release Name" required><br><br>
        <label for="desc">Release Description</label>
        <textarea id="desc" name="desc" rows="4" placeholder="Release Description" required></textarea><br><br>
        <label for="url">Release Page URL</label>
        <input type="url" id="url" name="url" placeholder="https://fridg3.org/music/your-release" required><br><br>
        <button type="submit">Send to Discord</button>
    </form>
</center>
</div>
</body>
</html>
