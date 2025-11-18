<?php
?>
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" type="text/css" href="/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="icon" type="image/x-icon" href="/resources/favicon.png"> 
    <title>fridge | contact</title>
    <meta name="description" content="Send me an email with an easy form!">
</head>

<body>
<div class="container">
<script src="/theme.js"></script>
<button id="change-theme"><i class="fa-solid fa-palette"></i></button>
    <center>
    <h1><a href="/">fridge</a></h1>
    <a href="/microblog">[micro]</a><a href="/blog">blog</a>
    <a href="/about">about</a>
    <span id="current">contact</span>
    <a href="/projects">projects</a>
    <a href="/music">music</a>
    </center>
<br><br>
<h3>Send an email!</h3>
<br>
<center>
    <form class="contact-form">

        <label for="name">Name</label>
        <input type="text" id="name" name="name"
               value="<?php echo isset($_POST['name']) ? htmlspecialchars($_POST['name'], ENT_QUOTES, 'UTF-8') : ''; ?>"
               required>

        <label for="email">Email Address</label>
        <input type="email" id="email" name="email"
               value="<?php echo isset($_POST['email']) ? htmlspecialchars($_POST['email'], ENT_QUOTES, 'UTF-8') : ''; ?>"
               required>

        <label for="message">Message</label>
        <textarea id="message" name="message" rows="4" required><?php
            echo isset($_POST['message']) ? htmlspecialchars($_POST['message'], ENT_QUOTES, 'UTF-8') : '';
        ?></textarea>

        <button type="submit">Send</button>

    </form>
</center>
<br>
<h4>Emails are sent directly to me@fridg3.org.</h4>
</div>
</body>
</html>
