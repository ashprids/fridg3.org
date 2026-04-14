<?php

$sessionBootstrapDir = __DIR__;
while (!file_exists($sessionBootstrapDir . '/lib/session.php') && dirname($sessionBootstrapDir) !== $sessionBootstrapDir) {
    $sessionBootstrapDir = dirname($sessionBootstrapDir);
}
require_once $sessionBootstrapDir . '/lib/session.php';
fridg3_start_session();

const TOAST_AVATAR_URL = 'https://images-ext-1.discordapp.net/external/S3f2i3R92rowfL9Uq5RmPFJtaqtluL-J7lVley9Ps7I/%3Fsize%3D4096/https/cdn.discordapp.com/avatars/1408177993284587794/2fd48df24ed679f3450b2532fce3f80b.png';

if (!isset($_SESSION['user']) || !isset($_SESSION['user']['username'])) {
    header('Location: /account/login');
    exit;
}

function find_template_file($filename) {
    $dir = __DIR__;
    $prev_dir = '';

    while ($dir !== $prev_dir) {
        $filepath = $dir . DIRECTORY_SEPARATOR . $filename;
        if (file_exists($filepath)) {
            return $filepath;
        }
        $prev_dir = $dir;
        $dir = dirname($dir);
    }

    return null;
}

function local_bot_post(string $path, array $payload): array {
    $url = 'http://127.0.0.1:8765' . $path;
    $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);
    if ($payloadJson === false) {
        return ['ok' => false, 'error' => 'failed to encode request'];
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadJson);
        $responseRaw = curl_exec($ch);
        if ($responseRaw === false) {
            $error = curl_error($ch);
            curl_close($ch);
            return ['ok' => false, 'error' => $error ?: 'could not contact discord bot'];
        }
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $decoded = json_decode((string) $responseRaw, true);
        if ($httpCode >= 400) {
            return ['ok' => false, 'error' => is_array($decoded) ? (string)($decoded['error'] ?? ('bot returned http ' . $httpCode)) : ('bot returned http ' . $httpCode)];
        }
        if (!is_array($decoded)) {
            return ['ok' => false, 'error' => 'invalid bot response'];
        }
        return $decoded;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $payloadJson,
            'timeout' => 10,
        ],
    ]);
    $responseRaw = @file_get_contents($url, false, $context);
    if ($responseRaw === false) {
        return ['ok' => false, 'error' => 'could not contact discord bot'];
    }

    $decoded = json_decode((string) $responseRaw, true);
    if (!is_array($decoded)) {
        return ['ok' => false, 'error' => 'invalid bot response'];
    }
    return $decoded;
}

function load_accounts_by_discord_id(string $accountsPath): array {
    if (!is_file($accountsPath)) {
        return [];
    }

    $data = json_decode((string) @file_get_contents($accountsPath), true);
    if (!isset($data['accounts']) || !is_array($data['accounts'])) {
        return [];
    }

    $byDiscord = [];
    foreach ($data['accounts'] as $account) {
        if (!is_array($account)) {
            continue;
        }
        $discordUserId = trim((string) ($account['discordUserId'] ?? ''));
        $username = trim((string) ($account['username'] ?? ''));
        if ($discordUserId === '' || $username === '') {
            continue;
        }
        if (!isset($byDiscord[$discordUserId])) {
            $byDiscord[$discordUserId] = [];
        }
        $byDiscord[$discordUserId][] = $username;
    }

    foreach ($byDiscord as $discordUserId => $usernames) {
        natcasesort($usernames);
        $byDiscord[$discordUserId] = array_values(array_unique($usernames));
    }

    return $byDiscord;
}

function load_accounts_by_username(string $accountsPath): array {
    if (!is_file($accountsPath)) {
        return [];
    }

    $data = json_decode((string) @file_get_contents($accountsPath), true);
    if (!isset($data['accounts']) || !is_array($data['accounts'])) {
        return [];
    }

    $byUsername = [];
    foreach ($data['accounts'] as $account) {
        if (!is_array($account)) {
            continue;
        }
        $discordUserId = trim((string) ($account['discordUserId'] ?? ''));
        $username = trim((string) ($account['username'] ?? ''));
        if ($discordUserId === '' || $username === '') {
            continue;
        }
        $byUsername[strtolower($username)] = [
            'username' => $username,
            'discord_user_id' => $discordUserId,
        ];
    }

    return $byUsername;
}

function resolve_compose_target(string $rawValue, array $accountsByUsername): string {
    $candidate = trim($rawValue);
    if ($candidate === '') {
        return '';
    }

    if (preg_match('/^\d{17,20}$/', $candidate)) {
        return $candidate;
    }

    $normalized = ltrim($candidate, '@');
    if (!preg_match('/^[A-Za-z0-9_-]{1,50}$/', $normalized)) {
        return '';
    }

    $account = $accountsByUsername[strtolower($normalized)] ?? null;
    if (!is_array($account)) {
        return '';
    }

    return (string) ($account['discord_user_id'] ?? '');
}

function load_dm_threads(string $historyPath): array {
    if (!is_file($historyPath)) {
        return [];
    }

    $data = json_decode((string) @file_get_contents($historyPath), true);
    if (!is_array($data) || !isset($data['threads']) || !is_array($data['threads'])) {
        return [];
    }

    $threads = [];
    foreach ($data['threads'] as $discordUserId => $thread) {
        if (!is_array($thread)) {
            continue;
        }

        $messages = [];
        foreach ((array) ($thread['messages'] ?? []) as $message) {
            if (!is_array($message)) {
                continue;
            }
            $content = trim((string) ($message['content'] ?? ''));
            $timestamp = trim((string) ($message['timestamp'] ?? ''));
            if ($content === '' || $timestamp === '') {
                continue;
            }
            $messages[] = [
                'id' => trim((string) ($message['id'] ?? '')),
                'direction' => trim((string) ($message['direction'] ?? 'inbound')) === 'outbound' ? 'outbound' : 'inbound',
                'content' => $content,
                'timestamp' => $timestamp,
            ];
        }

        $updatedAt = trim((string) ($thread['updated_at'] ?? ''));
        if ($updatedAt === '' && $messages !== []) {
            $updatedAt = (string) end($messages)['timestamp'];
        }

        $threads[] = [
            'discord_user_id' => trim((string) ($thread['discord_user_id'] ?? $discordUserId)),
            'username' => trim((string) ($thread['username'] ?? '')),
            'global_name' => trim((string) ($thread['global_name'] ?? '')),
            'display_name' => trim((string) ($thread['display_name'] ?? '')),
            'avatar_url' => trim((string) ($thread['avatar_url'] ?? '')),
            'updated_at' => $updatedAt,
            'messages' => $messages,
        ];
    }

    usort($threads, static function (array $a, array $b): int {
        return strcmp((string) ($b['updated_at'] ?? ''), (string) ($a['updated_at'] ?? ''));
    });

    return $threads;
}

function format_dm_timestamp(string $timestamp): string {
    if ($timestamp === '') {
        return '';
    }

    try {
        $date = new DateTimeImmutable($timestamp);
        return $date->setTimezone(new DateTimeZone(date_default_timezone_get()))->format('Y-m-d H:i');
    } catch (Exception $e) {
        return $timestamp;
    }
}

function build_thread_label(array $thread): string {
    $displayName = trim((string) ($thread['display_name'] ?? ''));
    $globalName = trim((string) ($thread['global_name'] ?? ''));
    $username = trim((string) ($thread['username'] ?? ''));

    if ($displayName !== '') {
        return $displayName;
    }
    if ($globalName !== '') {
        return $globalName;
    }
    if ($username !== '') {
        return '@' . $username;
    }

    return 'unknown user';
}

function shorten_preview(string $text, int $limit = 120): string {
    if (function_exists('mb_substr') && function_exists('mb_strlen')) {
        $preview = mb_substr($text, 0, $limit);
        if (mb_strlen($text) > $limit) {
            $preview .= '...';
        }
        return $preview;
    }

    $preview = substr($text, 0, $limit);
    if (strlen($text) > $limit) {
        $preview .= '...';
    }
    return $preview;
}

function build_avatar_html(array $thread, string $className = 'toast-dm-avatar'): string {
    $avatarUrl = trim((string) ($thread['avatar_url'] ?? ''));
    $label = build_thread_label($thread);
    $initial = function_exists('mb_substr') ? mb_strtoupper(mb_substr($label, 0, 1)) : strtoupper(substr($label, 0, 1));
    if ($initial === '') {
        $initial = '?';
    }

    if ($avatarUrl !== '') {
        return '<div class="' . htmlspecialchars($className, ENT_QUOTES, 'UTF-8') . '"><img src="'
            . htmlspecialchars($avatarUrl, ENT_QUOTES, 'UTF-8')
            . '" alt="'
            . htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
            . ' avatar"></div>';
    }

    return '<div class="' . htmlspecialchars($className, ENT_QUOTES, 'UTF-8') . ' fallback">'
        . htmlspecialchars($initial, ENT_QUOTES, 'UTF-8')
        . '</div>';
}

function build_toast_avatar_html(string $className = 'toast-dm-avatar'): string {
    return '<div class="' . htmlspecialchars($className, ENT_QUOTES, 'UTF-8') . '"><img src="'
        . htmlspecialchars(TOAST_AVATAR_URL, ENT_QUOTES, 'UTF-8')
        . '" alt="toast avatar"></div>';
}

$accountsPath = find_template_file('data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json');
$historyPath = find_template_file('data' . DIRECTORY_SEPARATOR . 'etc' . DIRECTORY_SEPARATOR . 'toast-dm-history.json');

if ($accountsPath && is_file($accountsPath)) {
    $accountsData = json_decode((string) @file_get_contents($accountsPath), true);
    if (isset($accountsData['accounts']) && is_array($accountsData['accounts'])) {
        foreach ($accountsData['accounts'] as $account) {
            if (isset($account['username']) && (string) $account['username'] === (string) $_SESSION['user']['username']) {
                $_SESSION['user']['isAdmin'] = (bool) ($account['isAdmin'] ?? false);
                break;
            }
        }
    }
}

if (empty($_SESSION['user']['isAdmin'])) {
    http_response_code(403);
    echo '403 forbidden: admin access required';
    exit;
}

$title = 'toast - private messages';
$description = 'read and send discord bot private messages';
$errorMessage = '';
$successMessage = '';
$composeMessage = '';
$selectedUserId = trim((string) ($_GET['user'] ?? ''));
$composeTargetValue = $selectedUserId;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $composeTargetValue = trim((string) ($_POST['discord_user_id'] ?? ''));
    $composeMessage = trim((string) ($_POST['message'] ?? ''));
    $accountsByUsername = load_accounts_by_username((string) $accountsPath);
    $selectedUserId = resolve_compose_target($composeTargetValue, $accountsByUsername);

    if ($selectedUserId === '') {
        $errorMessage = 'enter a linked website username or a valid discord user id.';
    } elseif ($composeMessage === '') {
        $errorMessage = 'message cannot be empty.';
    } else {
        $botResponse = local_bot_post('/messages/send', [
            'discord_user_id' => $selectedUserId,
            'message' => $composeMessage,
        ]);

        if (!empty($botResponse['ok'])) {
            header('Location: /others/toast-discord-bot/messages?user=' . rawurlencode($selectedUserId) . '&sent=1');
            exit;
        }

        $errorMessage = (string) ($botResponse['error'] ?? 'failed to send dm.');
    }
}

if (isset($_GET['sent']) && $_GET['sent'] === '1') {
    $successMessage = 'dm sent.';
}

$accountsByDiscordId = load_accounts_by_discord_id((string) $accountsPath);
$accountsByUsername = load_accounts_by_username((string) $accountsPath);
$threads = load_dm_threads((string) $historyPath);
$threadsById = [];
foreach ($threads as $thread) {
    $threadsById[$thread['discord_user_id']] = $thread;
}

if ($selectedUserId === '' && $threads !== []) {
    $selectedUserId = (string) $threads[0]['discord_user_id'];
}

if ($composeTargetValue === '') {
    $composeTargetValue = $selectedUserId;
}

$selectedThread = ($selectedUserId !== '' && isset($threadsById[$selectedUserId])) ? $threadsById[$selectedUserId] : null;

$threadCards = [];
foreach ($threads as $thread) {
    $discordUserId = (string) $thread['discord_user_id'];
    $isActive = $discordUserId === $selectedUserId;
    $messages = (array) ($thread['messages'] ?? []);
    $lastMessage = $messages !== [] ? end($messages) : null;
    $preview = $lastMessage ? shorten_preview((string) $lastMessage['content'], 120) : 'no messages yet';

    $siteUsernames = $accountsByDiscordId[$discordUserId] ?? [];
    $siteLabel = $siteUsernames !== [] ? '@' . implode(', @', $siteUsernames) : '';
    $threadMeta = $siteLabel !== '' ? htmlspecialchars($siteLabel, ENT_QUOTES, 'UTF-8') : htmlspecialchars($discordUserId, ENT_QUOTES, 'UTF-8');
    $threadCards[] = '<a class="toast-dm-thread' . ($isActive ? ' active' : '') . '" href="/others/toast-discord-bot/messages?user=' . rawurlencode($discordUserId) . '">'
        . build_avatar_html($thread)
        . '<div class="toast-dm-thread-copy">'
        . '<div class="toast-dm-thread-title-row">'
        . '<div class="toast-dm-thread-title">' . htmlspecialchars(build_thread_label($thread), ENT_QUOTES, 'UTF-8') . '</div>'
        . '<div class="toast-dm-thread-time">' . htmlspecialchars(format_dm_timestamp((string) ($thread['updated_at'] ?? '')), ENT_QUOTES, 'UTF-8') . '</div>'
        . '</div>'
        . '<div class="toast-dm-thread-meta">'
        . $threadMeta
        . '</div>'
        . '<div class="toast-dm-thread-preview">' . htmlspecialchars($preview, ENT_QUOTES, 'UTF-8') . '</div>'
        . '</div>'
        . '</a>';
}
$threadListHtml = $threadCards !== [] ? implode("\n", $threadCards) : '<div class="toast-dm-empty">no tracked dms yet. once somebody messages the bot, they’ll show up here.</div>';

$messageItems = [];
if ($selectedThread !== null) {
    foreach ((array) $selectedThread['messages'] as $message) {
        $direction = $message['direction'] === 'outbound' ? 'outbound' : 'inbound';
        $label = $direction === 'outbound' ? 'toast' : build_thread_label($selectedThread);
        $messageAvatar = $direction === 'outbound'
            ? build_toast_avatar_html('toast-dm-avatar toast-dm-avatar-toast')
            : build_avatar_html($selectedThread);

        $messageItems[] = '<div class="toast-dm-message ' . $direction . '">'
            . $messageAvatar
            . '<div class="toast-dm-message-copy">'
            . '<div class="toast-dm-message-meta">'
            . '<span class="toast-dm-message-author">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</span>'
            . '<span class="toast-dm-message-time">' . htmlspecialchars(format_dm_timestamp((string) $message['timestamp']), ENT_QUOTES, 'UTF-8') . '</span>'
            . '</div>'
            . '<div class="toast-dm-message-body">' . nl2br(htmlspecialchars((string) $message['content'], ENT_QUOTES, 'UTF-8')) . '</div>'
            . '</div>'
            . '</div>';
    }
}
$messageListHtml = $messageItems !== [] ? implode("\n", $messageItems) : '<div class="toast-dm-empty">pick a thread or type a discord user id to start a dm.</div>';

$selectedThreadLabel = $selectedThread !== null ? build_thread_label($selectedThread) : 'new message';
$selectedThreadMeta = '';
$selectedThreadAvatar = '<div class="toast-dm-header-avatar toast-dm-avatar fallback">?</div>';
if ($selectedThread !== null) {
    $linkedAccounts = $accountsByDiscordId[$selectedUserId] ?? [];
    $selectedThreadMeta = htmlspecialchars($selectedUserId, ENT_QUOTES, 'UTF-8');
    if ($linkedAccounts !== []) {
        $selectedThreadMeta .= ' • ' . htmlspecialchars('@' . implode(', @', $linkedAccounts), ENT_QUOTES, 'UTF-8');
    }
    $selectedThreadAvatar = build_avatar_html($selectedThread, 'toast-dm-header-avatar');
}

$content_path = find_template_file('content.html');
if (!$content_path) {
    die('content.html not found. report this issue to me@fridg3.org.');
}

$content = file_get_contents($content_path);
$content = str_replace(
    [
        '{error_style}',
        '{error_message}',
        '{success_style}',
        '{success_message}',
        '{thread_list}',
        '{selected_thread_avatar}',
        '{selected_thread_label}',
        '{selected_thread_meta}',
        '{message_list}',
        '{discord_user_id}',
        '{message}',
    ],
    [
        $errorMessage !== '' ? 'display:block;' : 'display:none;',
        htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8'),
        $successMessage !== '' ? 'display:block;' : 'display:none;',
        htmlspecialchars($successMessage, ENT_QUOTES, 'UTF-8'),
        $threadListHtml,
        $selectedThreadAvatar,
        htmlspecialchars($selectedThreadLabel, ENT_QUOTES, 'UTF-8'),
        $selectedThreadMeta,
        $messageListHtml,
        htmlspecialchars($composeTargetValue, ENT_QUOTES, 'UTF-8'),
        htmlspecialchars($composeMessage, ENT_QUOTES, 'UTF-8'),
    ],
    $content
);

echo '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . ' | fridg3.org</title>
    <meta name="description" content="' . htmlspecialchars($description, ENT_QUOTES, 'UTF-8') . '">
    <link rel="stylesheet" href="/style.css">
    <link rel="icon" type="image/png" href="/resources/favicon-96x96.png" sizes="96x96" />
    <link rel="shortcut icon" href="/resources/favicon-96x96.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/resources/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-title" content="fridg3.org" />
    <link rel="manifest" href="/resources/site.webmanifest" />
    <style>
        html, body {
            margin: 0;
            width: 100%;
            min-height: 100%;
            background: #1e1f22;
            overflow: hidden;
        }

        body {
            font-family: "MainRegular", monospace;
        }

        .toast-dm-page {
            margin: 0 !important;
            min-height: 100vh;
        }

        .toast-dm-shell {
            min-height: 100vh !important;
            border-radius: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
        }
    </style>
</head>
<body>' . $content . '
<script>
    (function () {
        const messageList = document.querySelector(".toast-dm-message-list");
        if (messageList) {
            messageList.scrollTop = messageList.scrollHeight;
        }
    })();
</script>
</body>
</html>';
?>
