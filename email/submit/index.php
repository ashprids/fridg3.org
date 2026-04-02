<?php

session_start();

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'email_guard.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /email');
    exit;
}

if (!email_contact_ensure_data_dir()) {
    header('Location: /email?error=storage');
    exit;
}

$visitor = email_contact_get_visitor_context();
$blacklistState = email_contact_load_json(email_contact_blacklist_path(), []);

if (email_contact_is_blacklisted_ip($blacklistState, $visitor['ip'])) {
    header('Location: /email?blacklisted=1');
    exit;
}

$submissionsState = email_contact_load_json(email_contact_submissions_path(), []);
$accessState = email_contact_get_access_state($visitor, $submissionsState, $blacklistState);

if ($accessState['is_on_cooldown']) {
    $cooldownAttempts = 0;
    $shouldBlacklist = false;

    $mutated = email_contact_mutate_json_file(email_contact_submissions_path(), function(array $state) use ($visitor, &$cooldownAttempts, &$shouldBlacklist): array {
        if (!isset($state['ips']) || !is_array($state['ips'])) {
            $state['ips'] = [];
        }

        $ip = $visitor['ip'];
        $record = [];
        if (isset($state['ips'][$ip]) && is_array($state['ips'][$ip])) {
            $record = $state['ips'][$ip];
        }

        $record['cooldown_attempts'] = (int)($record['cooldown_attempts'] ?? 0) + 1;
        $record['last_blocked_attempt_at'] = time();
        $record['last_fingerprint'] = $visitor['fingerprint'];
        $record['updated_at'] = gmdate('c');

        $cooldownAttempts = (int)$record['cooldown_attempts'];
        $shouldBlacklist = $cooldownAttempts > 3;

        $state['ips'][$ip] = $record;
        $state['updated_at'] = gmdate('c');
        return $state;
    });

    if (!$mutated) {
        header('Location: /email?error=storage');
        exit;
    }

    if ($shouldBlacklist) {
        $blacklisted = email_contact_mutate_json_file(email_contact_blacklist_path(), function(array $state) use ($visitor): array {
            if (!isset($state['ips']) || !is_array($state['ips'])) {
                $state['ips'] = [];
            }

            $state['ips'][$visitor['ip']] = [
                'reason' => 'email cooldown abuse',
                'blacklisted_at' => gmdate('c'),
                'last_fingerprint' => $visitor['fingerprint']
            ];
            $state['updated_at'] = gmdate('c');
            return $state;
        });

        if (!$blacklisted) {
            header('Location: /email?error=storage');
            exit;
        }

        header('Location: /email?blacklisted=1');
        exit;
    }

    header('Location: /email?cooldown=1');
    exit;
}

$name = trim((string)($_POST['name'] ?? ''));
$email = trim((string)($_POST['email'] ?? ''));
$message = trim((string)($_POST['message'] ?? ''));

$name = strip_tags(str_replace(["\r", "\n"], ' ', $name));
$message = strip_tags(str_replace(["\r\n", "\r"], "\n", $message));

$name = function_exists('mb_substr') ? mb_substr($name, 0, 120) : substr($name, 0, 120);
$message = function_exists('mb_substr') ? mb_substr($message, 0, 8000) : substr($message, 0, 8000);

$validatedEmail = filter_var($email, FILTER_VALIDATE_EMAIL);
if ($name === '' || $validatedEmail === false || $message === '') {
    header('Location: /email?error=validation');
    exit;
}

$postFields = http_build_query([
    '_captcha' => 'false',
    '_subject' => 'From /email/',
    '_template' => 'table',
    '_next' => 'https://fridg3.org/email?sent=1',
    'name' => $name,
    'email' => $validatedEmail,
    'message' => $message
], '', '&');

$sendOk = false;

if (function_exists('curl_init')) {
    $ch = curl_init(EMAIL_CONTACT_FORMSUBMIT_ENDPOINT);
    if ($ch !== false) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
        $response = curl_exec($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $sendOk = $response !== false && $statusCode >= 200 && $statusCode < 400;
        curl_close($ch);
    }
} else {
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $postFields,
            'timeout' => 15,
            'ignore_errors' => true
        ]
    ]);

    $response = @file_get_contents(EMAIL_CONTACT_FORMSUBMIT_ENDPOINT, false, $context);
    $statusLine = '';
    if (isset($http_response_header[0])) {
        $statusLine = (string)$http_response_header[0];
    }
    preg_match('/\s(\d{3})\s/', $statusLine, $matches);
    $statusCode = isset($matches[1]) ? (int)$matches[1] : 0;
    $sendOk = $response !== false && $statusCode >= 200 && $statusCode < 400;
}

if (!$sendOk) {
    header('Location: /email?error=send');
    exit;
}

$saved = email_contact_mutate_json_file(email_contact_submissions_path(), function(array $state) use ($visitor): array {
    if (!isset($state['visitors']) || !is_array($state['visitors'])) {
        $state['visitors'] = [];
    }
    if (!isset($state['ips']) || !is_array($state['ips'])) {
        $state['ips'] = [];
    }

    $now = time();
    $cooldownUntil = $now + EMAIL_CONTACT_COOLDOWN_SECONDS;

    $state['visitors'][$visitor['fingerprint']] = [
        'ip' => $visitor['ip'],
        'user_agent' => $visitor['user_agent'],
        'accept_language' => $visitor['accept_language'],
        'last_submission_at' => $now,
        'cooldown_until' => $cooldownUntil,
        'updated_at' => gmdate('c')
    ];

    $state['ips'][$visitor['ip']] = [
        'last_submission_at' => $now,
        'cooldown_until' => $cooldownUntil,
        'cooldown_attempts' => 0,
        'last_fingerprint' => $visitor['fingerprint'],
        'updated_at' => gmdate('c')
    ];

    $state['updated_at'] = gmdate('c');
    return $state;
});

if (!$saved) {
    header('Location: /email?error=storage');
    exit;
}

header('Location: /email?sent=1');
exit;

