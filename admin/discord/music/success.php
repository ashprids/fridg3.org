<?php
require_once $_SERVER['DOCUMENT_ROOT'] . '/admin/_auth.php';
// success.php - shown after a successful action in /discord/music
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="/style.css">
    <link rel="icon" type="image/x-icon" href="/resources/favicon.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <title>fridge | success!</title>
    <meta name="description" content="Task performed successfully">
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
<h3>Success!</h3>
<h4>Your action was performed successfully.</h4>
<?php
$post_url = isset($_GET['post_url']) ? $_GET['post_url'] : null;
if ($post_url) {
    echo '<a href="' . htmlspecialchars($post_url) . '" class="btn-view" style="display:inline-block;margin-top:24px;padding:12px 32px;background:#5865f2;color:#fff;border:none;border-radius:5px;font-size:1.1em;text-decoration:none;">View Post</a>';
}
?>
    </div>
</body>
</html>
