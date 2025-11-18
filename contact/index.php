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
        // your secret key (prefer environment variable, otherwise try .env file)
        // helper: load simple .env file if present (search up folders)
        function load_dotenv_file($path) {
            $out = [];
            if (!is_readable($path)) return $out;
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') continue;
                if (strpos($line, '=') === false) continue;
                list($k, $v) = explode('=', $line, 2);
                $k = trim($k);
                $v = trim($v);
                if ($v === '') { $out[$k] = ''; continue; }
                // remove surrounding quotes
                if ((($v[0] === '"') && (substr($v, -1) === '"')) || (($v[0] === "'") && (substr($v, -1) === "'"))) {
                    $v = substr($v, 1, -1);
                }
                $out[$k] = $v;
            }
            return $out;
        }

        // search for .env in current and parent directories (up to 3 levels)
        $envFromFile = [];
        $searchDirs = [__DIR__, dirname(__DIR__), dirname(dirname(__DIR__))];
        foreach ($searchDirs as $d) {
            $p = $d . DIRECTORY_SEPARATOR . '.env';
            if (is_readable($p)) {
                $envFromFile = array_merge($envFromFile, load_dotenv_file($p));
                break;
            }
        }

        $turnstileSecret = getenv('TURNSTILE_SECRET');
        if ($turnstileSecret === false || $turnstileSecret === null || $turnstileSecret === '') {
            $turnstileSecret = $envFromFile['TURNSTILE_SECRET'] ?? 'YOUR_TURNSTILE_SECRET_HERE';
        }

        // allow a bypass for local testing (set TURNSTILE_BYPASS=1 in env or .env)
        $bypass = getenv('TURNSTILE_BYPASS');
        if ($bypass === false || $bypass === null || $bypass === '') {
            $bypass = $envFromFile['TURNSTILE_BYPASS'] ?? null;
        }
        if ($bypass && (string)$bypass === '1') {
            // treat as successful for local/dev testing
            $data = ['success' => true, 'challenge_ts' => date('c'), 'hostname' => $_SERVER['HTTP_HOST'] ?? ''];
        } else {
            $data = null;
        }

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

        if ($data === null) {
            if ($response === false) {
                error_log('turnstile curl error: ' . curl_error($ch));
                $turnstileError = 'turnstile verification error. please try again later.';
            } else {
                $data = json_decode($response, true);
                // log full response for debugging (server error log only)
                error_log('turnstile response: ' . substr($response, 0, 1000));
                if (empty($data['success'])) {
                    if (!empty($data['error-codes'])) {
                        error_log('turnstile failed: ' . implode(', ', $data['error-codes']));
                    }
                    // if secret looks like placeholder, provide clearer guidance
                    if ($turnstileSecret === 'YOUR_TURNSTILE_SECRET_HERE' || $turnstileSecret === '') {
                        $turnstileError = 'turnstile not configured on the server (TURNSTILE_SECRET missing)';
                    } else {
                        $turnstileError = 'turnstile verification failed. please try again.';
                    }
                }
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

            // Prefer SMTP send when configured (read from environment or .env)
            // helper: load .env if present (search up folders)
            $envFromFile2 = [];
            $searchDirs2 = [__DIR__, dirname(__DIR__), dirname(dirname(__DIR__))];
            foreach ($searchDirs2 as $d) {
                $p = $d . DIRECTORY_SEPARATOR . '.env';
                if (is_readable($p)) { $envFromFile2 = array_merge($envFromFile2, load_dotenv_file($p)); break; }
            }

            $smtpHost = getenv('SMTP_HOST') ?: ($envFromFile2['SMTP_HOST'] ?? '');

            // minimal SMTP sender using sockets, supports ssl and starttls with AUTH LOGIN
            function smtp_get_resp($sock) {
                $data = '';
                while ($line = fgets($sock, 515)) {
                    $data .= $line;
                    // lines that start with 3-digit + space end the response
                    if (isset($line[3]) && $line[3] === ' ') break;
                }
                return $data;
            }

            function smtp_cmd($sock, $cmd) {
                fwrite($sock, $cmd . "\r\n");
            }

            function send_via_smtp($host, $port, $user, $pass, $secure, $from, $to, $subject, $body, $replyTo = null) {
                $timeout = 10;
                $transport = strtolower(trim((string)$secure));
                $remote = ($transport === 'ssl') ? "ssl://{$host}:{$port}" : "{$host}:{$port}";

                $errno = 0; $errstr = '';
                $sock = stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
                if (!$sock) return "connect_failed: {$errstr} ({$errno})";
                stream_set_timeout($sock, $timeout);

                $greet = smtp_get_resp($sock);
                if (strpos($greet, '220') !== 0) { fclose($sock); return "greet_failed: {$greet}"; }

                $domain = $_SERVER['SERVER_NAME'] ?? 'localhost';
                smtp_cmd($sock, "EHLO {$domain}");
                $ehlo = smtp_get_resp($sock);

                // if not already using SSL and server supports STARTTLS and we requested tls, upgrade
                if ($transport !== 'ssl' && stripos($ehlo, 'STARTTLS') !== false && $transport === 'tls') {
                    smtp_cmd($sock, 'STARTTLS');
                    $res = smtp_get_resp($sock);
                    if (strpos($res, '220') !== 0) { fclose($sock); return "starttls_failed: {$res}"; }
                    // enable crypto (TLS)
                    if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($sock); return 'enable_crypto_failed'; }
                    // re-ehlo
                    smtp_cmd($sock, "EHLO {$domain}");
                    $ehlo = smtp_get_resp($sock);
                }

                // authenticate if credentials provided
                if ($user !== '') {
                    smtp_cmd($sock, 'AUTH LOGIN');
                    $res = smtp_get_resp($sock);
                    if (strpos($res, '334') !== 0) { fclose($sock); return "auth_start_failed: {$res}"; }
                    smtp_cmd($sock, base64_encode($user));
                    $res = smtp_get_resp($sock);
                    smtp_cmd($sock, base64_encode($pass));
                    $res = smtp_get_resp($sock);
                    if (strpos($res, '235') !== 0) { fclose($sock); return "auth_failed: {$res}"; }
                }

                smtp_cmd($sock, "MAIL FROM:<{$from}>");
                $res = smtp_get_resp($sock);
                if (strpos($res, '250') !== 0) { fclose($sock); return "mailfrom_failed: {$res}"; }

                smtp_cmd($sock, "RCPT TO:<{$to}>");
                $res = smtp_get_resp($sock);
                if (!(strpos($res, '250') === 0 || strpos($res, '251') === 0)) { fclose($sock); return "rcptto_failed: {$res}"; }

                smtp_cmd($sock, 'DATA');
                $res = smtp_get_resp($sock);
                if (strpos($res, '354') !== 0) { fclose($sock); return "data_start_failed: {$res}"; }

                $headers = "From: {$from}\r\n";
                if (!empty($replyTo)) $headers .= "Reply-To: {$replyTo}\r\n";
                $headers .= "Subject: {$subject}\r\n";
                $headers .= "MIME-Version: 1.0\r\n";
                $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
                $msg = $headers . "\r\n" . $body;

                // dot-stuffing: make sure any line starting with '.' is prefixed with an extra '.'
                $msg = preg_replace('/(^|\r\n)\./', '\\1..', $msg);

                // ensure end marker
                $msg .= "\r\n.\r\n";
                fwrite($sock, $msg);
                $res = smtp_get_resp($sock);
                if (strpos($res, '250') !== 0) { fclose($sock); return "data_send_failed: {$res}"; }

                smtp_cmd($sock, 'QUIT');
                fclose($sock);
                return true;
            }

            if (!empty($smtpHost)) {
                $smtpPort = getenv('SMTP_PORT') ?: ($envFromFile2['SMTP_PORT'] ?? '587');
                $smtpUser = getenv('SMTP_USER') ?: ($envFromFile2['SMTP_USER'] ?? '');
                $smtpPass = getenv('SMTP_PASS') ?: ($envFromFile2['SMTP_PASS'] ?? '');
                $smtpSecure = getenv('SMTP_SECURE') ?: ($envFromFile2['SMTP_SECURE'] ?? 'tls');
                $smtpFrom = getenv('SMTP_FROM') ?: ($envFromFile2['SMTP_FROM'] ?? 'no-reply@fridg3.org');

                $ok = send_via_smtp($smtpHost, (int)$smtpPort, $smtpUser, $smtpPass, $smtpSecure, $smtpFrom, $to, $subject, $body, $email);
                if ($ok === true) {
                    header('Location: /contact/thanks.html');
                    exit;
                } else {
                    error_log('SMTP send failed: ' . (is_string($ok) ? $ok : 'unknown'));
                    $formError = 'there was an error sending your message. please try again later.';
                }
            } else {
                // fallback to mail()
                if (@mail($to, $subject, $body, $headers)) {
                    header('Location: /contact/thanks.html');
                    exit;
                } else {
                    $formError = 'there was an error sending your message. please try again later.';
                }
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
        <h4 style="color: #b14a4a;">
            <?php
                echo htmlspecialchars($turnstileError ?: $formError, ENT_QUOTES, 'UTF-8');
            ?>
        </h4>
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
