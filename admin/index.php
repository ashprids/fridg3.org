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
<h3>welcome, <?php echo $displayUser; ?>!</h3>
<?php if ($user === 'freezer'): ?>
<h4>love you lots &lt;3</h4>
<?php endif; ?>
<div id="posts">
    <?php if ($user === 'fridge'): ?>
    <a href="discord/" id="postlink"><div class="post"><br>
        <h3>Publish a Discord notification</h3>
        <center><p>Select a channel to publish a notification to, and format it automatically depending on the channel.</p></center>
    <br></div></a>
    <?php endif; ?>
    <?php if ($user === 'freezer' or $user === 'fridge'): ?>
    <a href="microblog/" id="postlink"><div class="post"><br>
        <h3>Make a /microblog/ post</h3>
        <center><p>Create a microblog post and automatically publish it to fridg3.org/microblog.</p></center>
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
