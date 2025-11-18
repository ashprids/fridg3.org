<?php
// contact/index.php

// optional: show errors while debugging (turn this off in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

$turnstileError = '';
$formError      = '';

// handle form submit
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // honeypot: if website field is filled, it's probably a bot
    $honeypot = $_POST['website'] ?? '';
    if (!empty($honeypot)) {
        // just pretend everything is fine but do nothing
        // you could also silently die();
        header('Location: /contact/thanks.html');
        exit;
    }

    // get turnstile token
    $turnstileToken = $_POST['cf-turnstile-response'] ?? '';

    if (empty($turnstileToken)) {
        $turnstileError = 'turnstile verification failed. please try again.';
    } else {
        // your secret key (set via env var ideally)
        $turnstileSecret = getenv('TURNSTILE_SECRET') ?: 'YOUR_TURNSTILE_SECRET_HERE';

        // optional: real user ip
        $remoteIp = $_SERVER['REMOTE_ADDR'] ?? null;

        // verify with cloudflare
        $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'secret'   => $turnstileSecret,
                'response' => $turnstileToken,
                'remoteip' => $remoteIp,
            ]),
            CURLOPT_TIMEOUT        => 5,
        ]);

        $response = curl_exec($ch);

        if ($response === false) {
            error_log('turnstile curl error: ' . curl_error($ch));
            $turnstileError = 'turnstile verification error. please try again later.';
        } else {
            $data = json_decode($response, true);
            if (empty($data['success'])) {
                if (!empty($data['error-codes'])) {
                    error_log('turnstile failed: ' . implode(', ', $data['error-codes']));
                }
                $turnstileError = 'turnstile verification failed. please try again.';
            }
        }

        curl_close($ch);
    }

    // if turnstile is good, handle the email
    if (empty($turnstileError)) {
        $name    = trim($_POST['name'] ?? '');
        $email   = trim($_POST['email'] ?? '');
        $message = trim($_POST['message'] ?? '');

        if ($name === '' || $email === '' || $message === '') {
            $formError = 'please fill out all fields.';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $formError = 'please enter a valid email address.';
        } else {
            // build email
            $to      = 'me@fridg3.org';
            $subject = 'New contact form submission from fridg3.org';
            $body    = "name: {$name}\n"
                     . "email: {$email}\n\n"
                     . "message:\n{$message}\n";
            $headers = 'From: fridg3.org <no-reply@fridg3.org>' . "\r\n"
                     . 'Reply-To: ' . $email . "\r\n";

            // send email
            if (@mail($to, $subject, $body, $headers)) {
                // bounce to thanks page like before
                header('Location: /contact/thanks.html');
                exit;
            } else {
                $formError = 'there was an error sending your message. please try again later.';
            }
        }
    }
}
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
<link rel="preconnect" href="https://challenges.cloudflare.com">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
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
    <?php if (!empty($turnstileError) || !empty($formError)): ?>
        <p style="color: #ff5555; margin-bottom: 1rem;">
            <?php
                echo htmlspecialchars($turnstileError ?: $formError, ENT_QUOTES, 'UTF-8');
            ?>
        </p>
    <?php endif; ?>

    <form action="/contact/index.php" method="POST" class="contact-form">
        <!-- honeypot -->
        <input type="text" name="website" id="website" style="display:none" autocomplete="off">

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

        <div class="cf-turnstile" data-sitekey="0x4AAAAAACBlG7ZSNHm5FMKm"></div>

        <button type="submit">Send</button>
    </form>
</center>
<script>
document.querySelector('.contact-form').addEventListener('submit', function(e) {
    var x = document.getElementById('website');
    if (x && x.value) {
        e.preventDefault();
    }
});
</script>
<br>
<h4>Emails are sent directly to me@fridg3.org.</h4>
</div>
</body>
</html>
