<?php
require_once $_SERVER['DOCUMENT_ROOT'] . '/admin/_auth.php';
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    // Delete the microblog search index file
    $index_path = __DIR__ . '/../../microblog/posts/index.json';

    if (!file_exists($index_path)) {
        die("index.json not found at: $index_path");
    }

    if (!is_writable($index_path)) {
        // try to change permissions if possible
        @chmod($index_path, 0664);
    }

    if (@unlink($index_path)) {
        // Redirect to success page
        header("Location: success.php");
        exit;
    } else {
        die("Failed to delete index.json. Check file permissions.");
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
    <title>fridge | clear /microblog/ search index</title>
    <meta name="description" content="Clear the /microblog/ search index">
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
<h3>Clear /microblog/ search index</h3>
<br>
<center>
    Are you sure you want to clear the /microblog/ search index? This will delete the file <code>index.json</code> located in <code>/microblog/posts/</code>.
    <br><br>
    The file will be regenerated once someone uses the search function.
    <form method="post" enctype="multipart/form-data" class="contact-form">
        <button type="submit">confirm</button>
    </form>
</center>
</div>
</body>
</html>

