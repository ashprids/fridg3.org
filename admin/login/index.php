<?php
// Login page for /admin
if (session_status() !== PHP_SESSION_ACTIVE) {
	session_start();
}

require_once $_SERVER['DOCUMENT_ROOT'] . '/admin/_config.php';

$error = '';
$redirect = isset($_GET['redirect']) ? $_GET['redirect'] : '/admin/';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$username = trim($_POST['name'] ?? '');
	$password = (string)($_POST['password'] ?? '');

	if ($username === '' || $password === '') {
		$error = 'Username and password are required.';
	} elseif (!in_array($username, $ALLOWED_USERNAMES, true)) {
		$error = 'Invalid username or password.';
	} else {
		$expected = $ADMIN_USERS[$username] ?? '';
		if ($expected !== '' && hash_equals($expected, $password)) {
			$_SESSION['admin_logged_in'] = true;
			$_SESSION['admin_user'] = $username;
			header('Location: ' . $redirect);
			exit;
		} else {
			$error = 'Invalid username or password.';
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
	<title>fridge | admin login</title>
	<meta name="description" content="Authorized Access Only">
	<style>
		.contact-form input { max-width: 320px; }
	</style>
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
<h3>Account Access</h3>
<br><br>
<center>
	<?php if ($error): ?>
		<div style="color:#f88; margin-bottom: 10px;">
			<?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?>
		</div>
	<?php endif; ?>
	<form class="contact-form" method="POST" action="?redirect=<?php echo urlencode($redirect); ?>">
		<label for="name">Username</label>
		<input type="text" id="name" name="name" required>

		<label for="password">Password</label>
		<input type="password" id="password" name="password" required>
		<br>
		<button type="submit">Login</button>
	</form>
	<p style="margin-top:10px"><small><a href="/">Back to site</a></small></p>
	<p style="margin-top:4px"><small><a href="/logout.php">Logout</a></small></p>
	</center>
<br>
</div>
</body>
</html>
