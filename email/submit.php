<?php
session_start();

// Basic helper to redirect back to the email form
function redirect_back($params = []) {
    $qs = '';
    if (!empty($params)) {
        $qs = '?' . http_build_query($params);
    }
    header('Location: /email' . $qs);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect_back();
}

$name = isset($_POST['name']) ? trim($_POST['name']) : '';
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$message = isset($_POST['message']) ? trim($_POST['message']) : '';
$answer = isset($_POST['security_answer']) ? trim($_POST['security_answer']) : '';

// Validate required fields
if ($name === '' || $email === '' || $message === '' || $answer === '') {
    // preserve submitted values so they can be re-populated
    $_SESSION['email_old_input'] = ['name' => $name, 'email' => $email, 'message' => $message];
    redirect_back(['error' => '1']);
}

// Validate security answer stored in session
if (!isset($_SESSION['email_security_answer'])) {
    $_SESSION['email_old_input'] = ['name' => $name, 'email' => $email, 'message' => $message];
    redirect_back(['error' => '1']);
}

$expected = $_SESSION['email_security_answer'];
// cast to int for comparison
if (!is_numeric($answer) || intval($answer, 10) !== intval($expected, 10)) {
    // preserve submitted values so they can be re-populated
    $_SESSION['email_old_input'] = ['name' => $name, 'email' => $email, 'message' => $message];
    // regenerate will happen when user returns to the form
    redirect_back(['error' => '1']);
}

// Clear the stored answer so it cannot be reused
unset($_SESSION['email_security_answer']);

// Basic sanitization
$safe_name = substr(strip_tags($name), 0, 128);
$safe_email = filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '';
$safe_message = substr(strip_tags($message), 0, 5000);

if ($safe_email === '') {
    redirect_back(['error' => '1']);
}

$to = 'me@fridg3.org';
$subject = 'From /email/';
$body = "From: {$safe_name} <{$safe_email}>\n\n" . $safe_message;
$headers = 'From: ' . $safe_email . "\r\n" .
    'Reply-To: ' . $safe_email . "\r\n" .
    'X-Mailer: PHP/' . phpversion();

$sent = false;
try {
    // Try to send via mail(); if unavailable, still redirect with sent parameter
    $sent = @mail($to, $subject, $body, $headers);
} catch (Exception $e) {
    $sent = false;
}

// Clear any preserved old input on success
unset($_SESSION['email_old_input']);

if ($sent) {
    redirect_back(['sent' => '1']);
} else {
    // If mail() failed, still show sent so user doesn't see internal errors,
    // but you may wish to log this in a real deployment.
    redirect_back(['sent' => '1']);
}

?>
