<?php
require_once $_SERVER['DOCUMENT_ROOT'] . '/admin/_auth.php';
$user = $_SESSION['admin_user'] ?? '';
$displayUser = htmlspecialchars($user, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" type="text/css" href="/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="icon" type="image/x-icon" href="/resources/favicon.png"> 
    <title>fridge | admin</title>
    <meta name="description" content="Authorized access only">
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
<br>

<?php if ($user === 'fridge'): ?>
<h3>Welcome, Ashton!</h3>
<?php endif; ?>

<?php if ($user === 'freezer'): ?>
<h3>Welcome, Yazmin!</h3>
<h4>love you lots &lt;3</h4>
<?php endif; ?>

<div id="posts">
    <?php if ($user === 'freezer' or $user === 'fridge'): ?>
    <a href="microblog/" id="postlink"><div class="post"><br>
        <h3>Make a /microblog/ post</h3>
        <center><p>Create a microblog post and automatically publish it to fridg3.org/microblog.</p></center>
    <br></div></a>
    <?php endif; ?>
    <?php if ($user === 'fridge'): ?>
    <a href="discord/" id="postlink"><div class="post"><br>
        <h3>Publish a Discord notification</h3>
        <center><p>Select a channel to publish a notification to, and format it automatically depending on the channel.</p></center>
    <br></div></a>
    <?php endif; ?>
    <?php if ($user === 'freezer' or $user === 'fridge'): ?>
    <a href="guestbook/" id="postlink"><div class="post"><br>
        <h3>Guestbook Admin</h3>
        <center><p>Manage guestbook entries and usernames, and post with an admin flare in fridg3.org/guestbook.</p></center>
    <br></div></a>
    <?php endif; ?>
    <?php if ($user === 'fridge'): ?>
    <a href="microblog-index/" id="postlink"><div class="post"><br>
        <h3>Clear /microblog/ search index</h3>
        <center><p>Deletes index.json, located in /microblog/posts/index.json to serve content via the search function efficiently</p></center>
    <br></div></a>
    <?php endif; ?>
</div>
<div id="downloadtext">The contents of this page are user-specific.</div>
</div>
</body>
</html>
