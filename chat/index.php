<?php
declare(strict_types=1);

$sessionBootstrapDir = __DIR__;
while (!file_exists($sessionBootstrapDir . "/lib/session.php") && dirname($sessionBootstrapDir) !== $sessionBootstrapDir) {
    $sessionBootstrapDir = dirname($sessionBootstrapDir);
}
require_once $sessionBootstrapDir . "/lib/session.php";
fridg3_start_session();

$title = 'chat';
$description = 'one-time private conversations without account setup.';
$rootDir = dirname(__DIR__);
$chatDataDir = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'chat';
$chatKeyPath = $chatDataDir . DIRECTORY_SEPARATOR . '.chat_key';
const CHAT_MAX_ATTACHMENT_BYTES = 8388608;

function chat_find_template_file(string $filename): ?string {
    $dir = __DIR__;
    $prevDir = '';

    while ($dir !== $prevDir) {
        $filepath = $dir . DIRECTORY_SEPARATOR . $filename;
        if (file_exists($filepath)) {
            return $filepath;
        }
        $prevDir = $dir;
        $dir = dirname($dir);
    }

    return null;
}

function chat_h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function chat_json_response(array $payload): void {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function chat_cookie_name(string $id): string {
    return 'fridg3_chat_' . $id;
}

function chat_get_conversation_id_from_request(): string {
    if (isset($_GET['id'])) {
        $id = preg_replace('/[^a-z0-9]/', '', strtolower((string)$_GET['id']));
        return is_string($id) && chat_is_valid_conversation_id($id) ? $id : '';
    }

    if (isset($_SERVER['PATH_INFO']) && preg_match('/^\/([a-z0-9]{9}|[a-f0-9]{32})$/', (string)$_SERVER['PATH_INFO'], $matches)) {
        return strtolower($matches[1]);
    }

    $path = parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: '';
    if (preg_match('#/chat/([a-z0-9]{9}|[a-f0-9]{32})/?$#', $path, $matches)) {
        return strtolower($matches[1]);
    }

    return '';
}

function chat_is_valid_conversation_id(string $id): bool {
    return preg_match('/^(?:[a-z0-9]{9}|[a-f0-9]{32})$/', $id) === 1;
}

function chat_ensure_data_dir(string $chatDataDir): void {
    if (!is_dir($chatDataDir)) {
        @mkdir($chatDataDir, 0750, true);
    }
}

function chat_get_key(string $chatDataDir, string $chatKeyPath): string {
    $envKey = getenv('FRIDG3_CHAT_KEY');
    if (is_string($envKey) && $envKey !== '') {
        $decoded = base64_decode($envKey, true);
        if (is_string($decoded) && strlen($decoded) >= 32) {
            return substr($decoded, 0, 32);
        }

        return hash('sha256', $envKey, true);
    }

    chat_ensure_data_dir($chatDataDir);
    if (is_file($chatKeyPath)) {
        $storedKey = @file_get_contents($chatKeyPath);
        if (is_string($storedKey) && strlen($storedKey) >= 32) {
            return substr($storedKey, 0, 32);
        }
    }

    $key = random_bytes(32);
    @file_put_contents($chatKeyPath, $key, LOCK_EX);
    @chmod($chatKeyPath, 0600);
    return $key;
}

function chat_conversation_path(string $chatDataDir, string $id): string {
    return $chatDataDir . DIRECTORY_SEPARATOR . $id . '.json';
}

function chat_generate_conversation_id(string $chatDataDir): string {
    $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    $max = strlen($chars) - 1;

    do {
        $id = '';
        for ($i = 0; $i < 9; $i++) {
            $id .= $chars[random_int(0, $max)];
        }
    } while (is_file(chat_conversation_path($chatDataDir, $id)));

    return $id;
}

function chat_presence_path(string $chatDataDir, string $id): string {
    return $chatDataDir . DIRECTORY_SEPARATOR . '.presence' . DIRECTORY_SEPARATOR . $id . '.json';
}

function chat_attachment_dir(string $chatDataDir, string $id): string {
    return $chatDataDir . DIRECTORY_SEPARATOR . '.attachments' . DIRECTORY_SEPARATOR . $id;
}

function chat_attachment_path(string $chatDataDir, string $conversationId, string $attachmentId): string {
    return chat_attachment_dir($chatDataDir, $conversationId) . DIRECTORY_SEPARATOR . $attachmentId . '.json';
}

function chat_remove_directory(string $directory): void {
    if (!is_dir($directory)) {
        return;
    }

    foreach (scandir($directory) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        $path = $directory . DIRECTORY_SEPARATOR . $entry;
        if (is_dir($path)) {
            chat_remove_directory($path);
        } else {
            @unlink($path);
        }
    }

    @rmdir($directory);
}

function chat_read_presence(string $chatDataDir, string $id): array {
    if (!chat_is_valid_conversation_id($id)) {
        return [];
    }

    $path = chat_presence_path($chatDataDir, $id);
    if (!is_file($path)) {
        return [];
    }

    $presence = json_decode((string)@file_get_contents($path), true);
    return is_array($presence) ? $presence : [];
}

function chat_write_presence(string $chatDataDir, string $id, array $presence): bool {
    if (!chat_is_valid_conversation_id($id)) {
        return false;
    }

    $directory = dirname(chat_presence_path($chatDataDir, $id));
    if (!is_dir($directory)) {
        @mkdir($directory, 0750, true);
    }

    $encoded = json_encode($presence, JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        return false;
    }

    return @file_put_contents(chat_presence_path($chatDataDir, $id), $encoded, LOCK_EX) !== false;
}

function chat_read_conversation(string $chatDataDir, string $chatKeyPath, string $id): ?array {
    if (!chat_is_valid_conversation_id($id)) {
        return null;
    }

    $path = chat_conversation_path($chatDataDir, $id);
    if (!is_file($path)) {
        return null;
    }

    $envelope = json_decode((string)@file_get_contents($path), true);
    if (!is_array($envelope) || ($envelope['version'] ?? null) !== 1) {
        return null;
    }

    $nonce = base64_decode((string)($envelope['nonce'] ?? ''), true);
    $tag = base64_decode((string)($envelope['tag'] ?? ''), true);
    $ciphertext = base64_decode((string)($envelope['ciphertext'] ?? ''), true);
    if (!is_string($nonce) || !is_string($tag) || !is_string($ciphertext)) {
        return null;
    }

    $plaintext = openssl_decrypt(
        $ciphertext,
        'aes-256-gcm',
        chat_get_key($chatDataDir, $chatKeyPath),
        OPENSSL_RAW_DATA,
        $nonce,
        $tag
    );
    if (!is_string($plaintext)) {
        return null;
    }

    $conversation = json_decode($plaintext, true);
    return is_array($conversation) ? $conversation : null;
}

function chat_write_conversation(string $chatDataDir, string $chatKeyPath, array $conversation): bool {
    chat_ensure_data_dir($chatDataDir);
    $id = (string)($conversation['id'] ?? '');
    if (!chat_is_valid_conversation_id($id)) {
        return false;
    }

    $plaintext = json_encode($conversation, JSON_UNESCAPED_SLASHES);
    if ($plaintext === false) {
        return false;
    }

    $nonce = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt(
        $plaintext,
        'aes-256-gcm',
        chat_get_key($chatDataDir, $chatKeyPath),
        OPENSSL_RAW_DATA,
        $nonce,
        $tag
    );
    if (!is_string($ciphertext) || !is_string($tag)) {
        return false;
    }

    $envelope = json_encode([
        'version' => 1,
        'cipher' => 'aes-256-gcm',
        'nonce' => base64_encode($nonce),
        'tag' => base64_encode($tag),
        'ciphertext' => base64_encode($ciphertext),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($envelope === false) {
        return false;
    }

    $path = chat_conversation_path($chatDataDir, $id);
    $tempPath = tempnam($chatDataDir, 'chat_');
    if ($tempPath === false) {
        return @file_put_contents($path, $envelope, LOCK_EX) !== false;
    }

    $ok = @file_put_contents($tempPath, $envelope, LOCK_EX) !== false && @rename($tempPath, $path);
    if (!$ok) {
        @unlink($tempPath);
    }
    return $ok;
}

function chat_delete_conversation(string $chatDataDir, string $id): bool {
    if (!chat_is_valid_conversation_id($id)) {
        return false;
    }

    $path = chat_conversation_path($chatDataDir, $id);
    @unlink(chat_presence_path($chatDataDir, $id));
    chat_remove_directory(chat_attachment_dir($chatDataDir, $id));
    return !is_file($path) || @unlink($path);
}

function chat_load_all_conversations(string $chatDataDir, string $chatKeyPath): array {
    if (!is_dir($chatDataDir)) {
        return [];
    }

    $conversations = [];
    foreach (glob($chatDataDir . DIRECTORY_SEPARATOR . '*.json') ?: [] as $file) {
        $id = basename($file, '.json');
        $conversation = chat_read_conversation($chatDataDir, $chatKeyPath, $id);
        if (is_array($conversation)) {
            $conversations[] = $conversation;
        }
    }

    usort($conversations, static function (array $a, array $b): int {
        return (int)($b['createdAt'] ?? 0) <=> (int)($a['createdAt'] ?? 0);
    });

    return $conversations;
}

function chat_refresh_current_user_permissions(): void {
    if (!isset($_SESSION['user']['username'])) {
        return;
    }

    $accountsPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
    if (!is_file($accountsPath)) {
        return;
    }

    $accountsData = json_decode((string)@file_get_contents($accountsPath), true);
    if (!is_array($accountsData) || !isset($accountsData['accounts']) || !is_array($accountsData['accounts'])) {
        return;
    }

    foreach ($accountsData['accounts'] as $account) {
        if (($account['username'] ?? null) !== $_SESSION['user']['username']) {
            continue;
        }

        $_SESSION['user']['name'] = chat_h((string)($account['name'] ?? ''));
        $_SESSION['user']['isAdmin'] = (bool)($account['isAdmin'] ?? false);
        $_SESSION['user']['allowedPages'] = array_map('strval', (array)($account['allowedPages'] ?? []));
        return;
    }
}

function chat_user_can_manage(): bool {
    if (!isset($_SESSION['user'])) {
        return false;
    }

    $allowedPages = array_map('strval', (array)($_SESSION['user']['allowedPages'] ?? []));
    return !empty($_SESSION['user']['isAdmin']) || in_array('chat', $allowedPages, true);
}

function chat_get_viewer_role(array $conversation, string $conversationId, bool $canManage): string {
    if ($canManage) {
        return 'manager';
    }

    $cookieSecret = (string)($_COOKIE[chat_cookie_name($conversationId)] ?? '');
    $cookieHash = $cookieSecret === '' ? '' : hash('sha256', $cookieSecret);
    $participantHash = (string)($conversation['participantHash'] ?? '');

    return $cookieHash !== '' && $participantHash !== '' && hash_equals($participantHash, $cookieHash)
        ? 'participant'
        : '';
}

function chat_presence_payload(array $presence, string $viewerRole): array {
    $otherRole = $viewerRole === 'manager' ? 'participant' : 'manager';
    $lastSeen = (int)($presence[$otherRole] ?? 0);

    return [
        'ok' => true,
        'viewerRole' => $viewerRole,
        'otherRole' => $otherRole,
        'otherOnline' => $lastSeen > 0 && (time() - $lastSeen) <= 15,
        'otherLastSeen' => $lastSeen,
    ];
}

function chat_request_wants_json(): bool {
    $accept = (string)($_SERVER['HTTP_ACCEPT'] ?? '');
    $requestedWith = (string)($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '');

    return stripos($accept, 'application/json') !== false
        || strcasecmp($requestedWith, 'XMLHttpRequest') === 0;
}

function chat_user_can_view_conversation(array $conversation, string $conversationId, bool $canManage): bool {
    return chat_get_viewer_role($conversation, $conversationId, $canManage) !== '';
}

function chat_clean_filename(string $filename): string {
    $filename = trim(basename($filename));
    $filename = preg_replace('/[^\w.\- ]+/', '_', $filename);
    $filename = is_string($filename) ? trim($filename, " .\t\n\r\0\x0B") : '';

    return $filename === '' ? 'attachment' : substr($filename, 0, 120);
}

function chat_detect_mime(string $path, string $fallback = 'application/octet-stream'): string {
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $mime = finfo_file($finfo, $path);
            finfo_close($finfo);
            if (is_string($mime) && $mime !== '') {
                return $mime;
            }
        }
    }

    return $fallback;
}

function chat_encrypt_attachment(string $chatDataDir, string $chatKeyPath, string $conversationId, array $upload): ?array {
    if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if (($upload['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        return null;
    }

    $size = (int)($upload['size'] ?? 0);
    $tmpName = (string)($upload['tmp_name'] ?? '');
    if ($size <= 0 || $size > CHAT_MAX_ATTACHMENT_BYTES || !is_uploaded_file($tmpName)) {
        return null;
    }

    $data = @file_get_contents($tmpName);
    if (!is_string($data)) {
        return null;
    }

    $attachmentId = bin2hex(random_bytes(16));
    $name = chat_clean_filename((string)($upload['name'] ?? 'attachment'));
    $mime = chat_detect_mime($tmpName);
    $nonce = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt(
        $data,
        'aes-256-gcm',
        chat_get_key($chatDataDir, $chatKeyPath),
        OPENSSL_RAW_DATA,
        $nonce,
        $tag
    );
    if (!is_string($ciphertext) || !is_string($tag)) {
        return null;
    }

    $directory = chat_attachment_dir($chatDataDir, $conversationId);
    if (!is_dir($directory)) {
        @mkdir($directory, 0750, true);
    }

    $envelope = json_encode([
        'version' => 1,
        'cipher' => 'aes-256-gcm',
        'name' => $name,
        'mime' => $mime,
        'size' => $size,
        'nonce' => base64_encode($nonce),
        'tag' => base64_encode($tag),
        'ciphertext' => base64_encode($ciphertext),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($envelope === false) {
        return null;
    }

    if (@file_put_contents(chat_attachment_path($chatDataDir, $conversationId, $attachmentId), $envelope, LOCK_EX) === false) {
        return null;
    }

    return [
        'id' => $attachmentId,
        'name' => $name,
        'mime' => $mime,
        'size' => $size,
    ];
}

function chat_load_attachment(string $chatDataDir, string $chatKeyPath, string $conversationId, string $attachmentId): ?array {
    if (!chat_is_valid_conversation_id($conversationId) || !preg_match('/^[a-f0-9]{32}$/', $attachmentId)) {
        return null;
    }

    $path = chat_attachment_path($chatDataDir, $conversationId, $attachmentId);
    if (!is_file($path)) {
        return null;
    }

    $envelope = json_decode((string)@file_get_contents($path), true);
    if (!is_array($envelope) || ($envelope['version'] ?? null) !== 1) {
        return null;
    }

    $nonce = base64_decode((string)($envelope['nonce'] ?? ''), true);
    $tag = base64_decode((string)($envelope['tag'] ?? ''), true);
    $ciphertext = base64_decode((string)($envelope['ciphertext'] ?? ''), true);
    if (!is_string($nonce) || !is_string($tag) || !is_string($ciphertext)) {
        return null;
    }

    $data = openssl_decrypt(
        $ciphertext,
        'aes-256-gcm',
        chat_get_key($chatDataDir, $chatKeyPath),
        OPENSSL_RAW_DATA,
        $nonce,
        $tag
    );
    if (!is_string($data)) {
        return null;
    }

    return [
        'name' => chat_clean_filename((string)($envelope['name'] ?? 'attachment')),
        'mime' => (string)($envelope['mime'] ?? 'application/octet-stream'),
        'size' => (int)($envelope['size'] ?? strlen($data)),
        'data' => $data,
    ];
}

function chat_format_bytes(int $bytes): string {
    if ($bytes >= 1048576) {
        return rtrim(rtrim(number_format($bytes / 1048576, 1), '0'), '.') . ' MB';
    }

    if ($bytes >= 1024) {
        return rtrim(rtrim(number_format($bytes / 1024, 1), '0'), '.') . ' KB';
    }

    return $bytes . ' B';
}

function chat_set_participant_cookie(string $id, string $secret): void {
    setcookie(chat_cookie_name($id), $secret, [
        'expires' => time() + 60 * 60 * 24 * 365,
        'path' => '/chat',
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    $_COOKIE[chat_cookie_name($id)] = $secret;
}

function chat_render_page(string $title, string $description, string $content): void {
    $renderHelperPath = chat_find_template_file('lib/render.php');
    if ($renderHelperPath) {
        require_once $renderHelperPath;
    }

    $templateName = function_exists('get_preferred_template_name')
        ? get_preferred_template_name(__DIR__)
        : 'template.html';
    $templatePath = chat_find_template_file($templateName);
    if (!$templatePath && $templateName !== 'template.html') {
        $templatePath = chat_find_template_file('template.html');
    }
    if (!$templatePath) {
        die('page template not found. report this issue to me@fridg3.org.');
    }

    $html = (string)file_get_contents($templatePath);
    if (function_exists('apply_preferred_theme_stylesheet')) {
        $html = apply_preferred_theme_stylesheet($html, __DIR__);
    }

    $html = str_replace('{content}', $content, $html);
    $html = str_replace('{title}', $title, $html);
    $html = str_replace('{description}', $description, $html);

    $userGreeting = '';
    if (isset($_SESSION['user']['name'])) {
        $userGreeting = '<div id="user-greeting">Hello, ' . chat_h((string)$_SESSION['user']['name']) . '!</div>';
        $accountBtn = '<a href="/account"><div id="footer-button" data-tooltip="access your fridg3.org account"><i class="fa-solid fa-user"></i></div></a>';
        $logoutBtn = '<a href="/account/logout"><div id="footer-button" data-tooltip="log out"><i class="fa-solid fa-right-from-bracket"></i></div></a>';
        $html = str_replace($accountBtn, $logoutBtn, $html);
    }

    echo str_replace('{user_greeting}', $userGreeting, $html);
}

function chat_render_error(string $heading, string $subheading, int $statusCode = 403): void {
    http_response_code($statusCode);
    chat_render_page($heading, 'private chat access notice.', '<h1>' . chat_h($heading) . '</h1><h2>' . chat_h($subheading) . '</h2><br><p><a href="/">return home</a></p>');
    exit;
}

function chat_message_html(array $conversation, string $viewerRole): string {
    $messages = (array)($conversation['messages'] ?? []);
    if ($messages === []) {
        return '<div class="chat-empty">no messages yet.</div>';
    }

    $html = '';
    $lastDateKey = '';
    $recipientName = trim((string)($conversation['name'] ?? 'recipient'));
    if ($recipientName === '') {
        $recipientName = 'recipient';
    }
    foreach ($messages as $message) {
        if (!is_array($message)) {
            continue;
        }
        $createdAt = (int)($message['createdAt'] ?? time());
        $dateKey = date('Y-m-d', $createdAt);
        if ($dateKey !== $lastDateKey) {
            $html .= '<div class="chat-date-divider"><span>' . chat_h(date('M j, Y', $createdAt)) . '</span></div>';
            $lastDateKey = $dateKey;
        }

        $sender = (string)($message['sender'] ?? 'unknown');
        $isOwn = $sender === $viewerRole;
        $senderLabel = $isOwn ? 'you' : ($sender === 'manager' ? 'fridge' : $recipientName);
        $time = date('H:i', $createdAt);
        $body = nl2br(chat_h((string)($message['body'] ?? '')), false);
        $attachmentHtml = '';
        $attachment = is_array($message['attachment'] ?? null) ? $message['attachment'] : null;
        if ($attachment !== null && isset($conversation['id'])) {
            $attachmentId = (string)($attachment['id'] ?? '');
            $attachmentName = chat_clean_filename((string)($attachment['name'] ?? 'attachment'));
            $attachmentMime = (string)($attachment['mime'] ?? 'application/octet-stream');
            $attachmentSize = chat_format_bytes((int)($attachment['size'] ?? 0));
            $attachmentUrl = '/chat/' . rawurlencode((string)$conversation['id']) . '?action=attachment&file=' . rawurlencode($attachmentId);

            if (str_starts_with($attachmentMime, 'image/')) {
                $attachmentHtml = '<div class="chat-attachment chat-attachment-image"><img src="' . chat_h($attachmentUrl) . '" alt="' . chat_h($attachmentName) . '"></div>';
            } else {
                $attachmentHtml = '<a class="chat-attachment chat-attachment-file" href="' . chat_h($attachmentUrl) . '"><span>' . chat_h($attachmentName) . '</span><small>' . chat_h($attachmentSize) . '</small></a>';
            }
        }

        $html .= '<article class="chat-message chat-message-' . ($isOwn ? 'own' : 'other') . ' chat-message-' . chat_h($sender) . '" data-message-id="' . chat_h((string)($message['id'] ?? '')) . '">'
            . '<div class="chat-message-meta"><strong>' . chat_h($senderLabel) . '</strong><span>' . chat_h($time) . '</span></div>'
            . ($body !== '' ? '<div class="chat-message-body">' . $body . '</div>' : '')
            . $attachmentHtml
            . '</article>';
    }

    return $html;
}

chat_refresh_current_user_permissions();
$conversationId = chat_get_conversation_id_from_request();
$action = (string)($_POST['action'] ?? $_GET['action'] ?? '');
$canManage = chat_user_can_manage();

if ($action === 'status' && $conversationId !== '') {
    chat_json_response(['exists' => is_file(chat_conversation_path($chatDataDir, $conversationId))]);
}

if ($action === 'presence' && $conversationId !== '') {
    $conversation = chat_read_conversation($chatDataDir, $chatKeyPath, $conversationId);
    if ($conversation === null) {
        chat_json_response(['ok' => false, 'exists' => false]);
    }

    $viewerRole = chat_get_viewer_role($conversation, $conversationId, $canManage);
    if ($viewerRole === '') {
        http_response_code(403);
        chat_json_response(['ok' => false, 'exists' => true]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $presence = chat_read_presence($chatDataDir, $conversationId);
        $presence[$viewerRole] = time();
        chat_write_presence($chatDataDir, $conversationId, $presence);
    } else {
        $presence = chat_read_presence($chatDataDir, $conversationId);
    }

    chat_json_response(chat_presence_payload($presence, $viewerRole) + ['exists' => true]);
}

if ($action === 'messages' && $conversationId !== '') {
    $conversation = chat_read_conversation($chatDataDir, $chatKeyPath, $conversationId);
    if ($conversation === null) {
        chat_json_response(['ok' => false, 'exists' => false]);
    }

    $viewerRole = chat_get_viewer_role($conversation, $conversationId, $canManage);
    if ($viewerRole === '') {
        http_response_code(403);
        chat_json_response(['ok' => false, 'exists' => true]);
    }

    $messages = (array)($conversation['messages'] ?? []);
    $lastMessage = end($messages);
    $lastMessageId = is_array($lastMessage) ? (string)($lastMessage['id'] ?? '') : '';

    chat_json_response([
        'ok' => true,
        'exists' => true,
        'html' => chat_message_html($conversation, $viewerRole),
        'count' => count($messages),
        'lastMessageId' => $lastMessageId,
    ]);
}

if ($action === 'attachment' && $conversationId !== '') {
    $conversation = chat_read_conversation($chatDataDir, $chatKeyPath, $conversationId);
    if ($conversation === null || !chat_user_can_view_conversation($conversation, $conversationId, $canManage)) {
        chat_render_error('chat access denied', 'that attachment is only available inside this chat.', 403);
    }

    $attachmentId = preg_replace('/[^a-f0-9]/', '', strtolower((string)($_GET['file'] ?? '')));
    $attachment = is_string($attachmentId)
        ? chat_load_attachment($chatDataDir, $chatKeyPath, $conversationId, $attachmentId)
        : null;
    if ($attachment === null) {
        chat_render_error('attachment unavailable', 'that file is missing or already deleted.', 404);
    }

    $mime = preg_match('#^[\w.+-]+/[\w.+-]+$#', $attachment['mime']) ? $attachment['mime'] : 'application/octet-stream';
    $disposition = str_starts_with($mime, 'image/') ? 'inline' : 'attachment';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . strlen((string)$attachment['data']));
    header('Content-Disposition: ' . $disposition . '; filename="' . addcslashes((string)$attachment['name'], "\\\"") . '"');
    header('X-Content-Type-Options: nosniff');
    echo $attachment['data'];
    exit;
}

if ($conversationId === '' && !$canManage) {
    if (isset($_SESSION['user']['username'])) {
        chat_render_error('chat access denied', 'your account does not have the chat permission.', 403);
    }
    header('Location: /account/login');
    exit;
}

if ($conversationId === '' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($action === 'create') {
        $name = trim((string)($_POST['name'] ?? ''));
        if ($name === '' || strlen($name) > 120) {
            header('Location: /chat?error=' . rawurlencode('conversation name is required and must be 120 chars or less.'));
            exit;
        }

        $id = chat_generate_conversation_id($chatDataDir);
        $conversation = [
            'id' => $id,
            'name' => $name,
            'createdAt' => time(),
            'createdBy' => (string)($_SESSION['user']['username'] ?? 'unknown'),
            'participantHash' => '',
            'claimedAt' => null,
            'messages' => [],
        ];

        if (!chat_write_conversation($chatDataDir, $chatKeyPath, $conversation)) {
            header('Location: /chat?error=' . rawurlencode('failed to create chat. check data/chat permissions.'));
            exit;
        }

        header('Location: /chat?created=' . rawurlencode($id));
        exit;
    }
}

if ($conversationId !== '' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($action === 'delete') {
        if (!$canManage) {
            chat_render_error('chat access denied', 'only chat managers can delete conversations.', 403);
        }

        chat_delete_conversation($chatDataDir, $conversationId);
        header('Location: /chat?deleted=1');
        exit;
    }

    if ($action === 'send') {
        $conversation = chat_read_conversation($chatDataDir, $chatKeyPath, $conversationId);
        if ($conversation === null) {
            if (chat_request_wants_json()) {
                chat_json_response(['ok' => false, 'exists' => false]);
            }
            chat_render_error('this conversation has ended', 'the conversation data is gone from the server.', 410);
        }

        $viewerRole = chat_get_viewer_role($conversation, $conversationId, $canManage);
        if ($viewerRole === '') {
            if (chat_request_wants_json()) {
                http_response_code(403);
                chat_json_response(['ok' => false, 'exists' => true]);
            }
            chat_render_error('chat access denied', 'this link has already been claimed by another browser.', 403);
        }

        $body = trim((string)($_POST['message'] ?? ''));
        $upload = is_array($_FILES['attachment'] ?? null) ? $_FILES['attachment'] : null;
        $attachment = $upload !== null
            ? chat_encrypt_attachment($chatDataDir, $chatKeyPath, $conversationId, $upload)
            : null;
        $uploadError = $upload !== null && ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE && $attachment === null;

        if ($uploadError && chat_request_wants_json()) {
            http_response_code(400);
            chat_json_response(['ok' => false, 'exists' => true, 'error' => 'attachment failed. max size is 8 MB.']);
        }

        if (($body !== '' || $attachment !== null) && strlen($body) <= 4000) {
            $messages = (array)($conversation['messages'] ?? []);
            $message = [
                'id' => bin2hex(random_bytes(8)),
                'sender' => $viewerRole,
                'body' => $body,
                'createdAt' => time(),
            ];
            if ($attachment !== null) {
                $message['attachment'] = $attachment;
            }
            $messages[] = $message;
            $conversation['messages'] = $messages;
            chat_write_conversation($chatDataDir, $chatKeyPath, $conversation);
        }

        if (chat_request_wants_json()) {
            $messages = (array)($conversation['messages'] ?? []);
            $lastMessage = end($messages);
            chat_json_response([
                'ok' => true,
                'exists' => true,
                'html' => chat_message_html($conversation, $viewerRole),
                'count' => count($messages),
                'lastMessageId' => is_array($lastMessage) ? (string)($lastMessage['id'] ?? '') : '',
            ]);
        }

        header('Location: /chat/' . rawurlencode($conversationId));
        exit;
    }
}

if ($conversationId !== '') {
    $conversation = chat_read_conversation($chatDataDir, $chatKeyPath, $conversationId);
    $cookieName = chat_cookie_name($conversationId);
    $cookieSecret = (string)($_COOKIE[$cookieName] ?? '');

    if ($conversation === null) {
        if ($cookieSecret !== '') {
            chat_render_error('this conversation has ended', 'the conversation data has been deleted from the server.', 410);
        }
        chat_render_error('chat unavailable', 'that chat is missing, ended, or never existed.', 404);
    }

    if (!$canManage) {
        $participantHash = (string)($conversation['participantHash'] ?? '');
        if ($participantHash === '') {
            $secret = bin2hex(random_bytes(32));
            $conversation['participantHash'] = hash('sha256', $secret);
            $conversation['claimedAt'] = time();
            chat_write_conversation($chatDataDir, $chatKeyPath, $conversation);
            chat_set_participant_cookie($conversationId, $secret);
            $authUrl = '/chat/' . rawurlencode($conversationId);
            chat_render_page('authenticating', 'private chat authentication.', '<h1>authenticating...</h1><h2>locking this chat to your browser.</h2><br><script>setTimeout(function(){ window.location.href = ' . json_encode($authUrl) . '; }, 900);</script><p><a href="' . chat_h($authUrl) . '">continue</a></p>');
            exit;
        }

        $cookieHash = $cookieSecret === '' ? '' : hash('sha256', $cookieSecret);
        if ($cookieHash === '' || !hash_equals($participantHash, $cookieHash)) {
            chat_render_error('chat access denied', 'this one-time link has already been claimed by another browser.', 403);
        }
    }

    $viewerRole = chat_get_viewer_role($conversation, $conversationId, $canManage);
    $recipientName = trim((string)($conversation['name'] ?? 'recipient'));
    if ($recipientName === '') {
        $recipientName = 'recipient';
    }
    $content = '<section class="chat-view" data-chat-id="' . chat_h($conversationId) . '" data-recipient-name="' . chat_h($recipientName) . '">'
        . '<div class="chat-header-row"><div><h1>private chat</h1><h2>recipient: ' . chat_h($recipientName) . '</h2><div class="chat-presence" id="chat-presence" aria-live="polite">checking if the other user is online...</div></div>'
        . ($canManage ? '<form method="post" action="/chat/' . chat_h($conversationId) . '" data-no-spa="1" onsubmit="return confirm(\'end this conversation and delete all messages?\')"><input type="hidden" name="action" value="delete"><button class="danger-button chat-delete-button" type="submit">end chat</button></form>' : '')
        . '</div>'
        . '<div class="chat-messages" id="chat-messages" aria-live="polite">' . chat_message_html($conversation, $viewerRole) . '</div>'
        . '<form class="chat-send-form" method="post" action="/chat/' . chat_h($conversationId) . '" enctype="multipart/form-data" data-no-spa="1">'
        . '<input type="hidden" name="action" value="send">'
        . '<label class="chat-attach-button" data-tooltip="attach image or file up to 8 MB"><input name="attachment" type="file" accept="image/*,.pdf,.txt,.md,.zip,.7z,.rar,.mp3,.wav,.ogg,.mp4,.webm,.json,.csv">+</label>'
        . '<textarea name="message" rows="2" maxlength="4000" placeholder="message"></textarea>'
        . '<button class="chat-send-button" type="submit">send</button>'
        . '<div class="chat-file-indicator" aria-live="polite"></div>'
        . '</form>'
        . ($canManage ? '<p><a href="/chat">back to chat dashboard</a></p>' : '')
        . '<script>(function(){function initChat(){var root=document.querySelector(".chat-view");if(!root||root.dataset.chatBound==="1")return;root.dataset.chatBound="1";var id=root.getAttribute("data-chat-id");var presenceEl=document.getElementById("chat-presence");var messagesEl=document.getElementById("chat-messages");var form=document.querySelector(".chat-send-form");var textarea=form?form.querySelector("[name=\'message\']"):null;var fileInput=form?form.querySelector("[name=\'attachment\']"):null;var fileIndicator=form?form.querySelector(".chat-file-indicator"):null;var sendButton=form?form.querySelector(".chat-send-button"):null;var lastMessageId="";function label(role){return role==="manager"?"fridge":(root.getAttribute("data-recipient-name")||"recipient");}function scrollMessages(force){if(!messagesEl)return;var nearBottom=messagesEl.scrollHeight-messagesEl.scrollTop-messagesEl.clientHeight<110;if(force||nearBottom){messagesEl.scrollTop=messagesEl.scrollHeight;}}function renderPresence(data){if(!presenceEl||!data||!data.ok)return;presenceEl.className="chat-presence "+(data.otherOnline?"chat-presence-online":"chat-presence-offline");presenceEl.textContent=label(data.otherRole)+" is "+(data.otherOnline?"online":"offline");}function renderMessages(data,force){if(!messagesEl||!data||!data.ok)return;if(data.lastMessageId!==lastMessageId||messagesEl.innerHTML===""){messagesEl.innerHTML=data.html;lastMessageId=data.lastMessageId||"";scrollMessages(force);}}function syncFileIndicator(){if(!fileIndicator||!fileInput)return;var file=fileInput.files&&fileInput.files[0]?fileInput.files[0]:null;fileIndicator.textContent=file?("attached: "+file.name):"";fileIndicator.style.display=file?"block":"none";}function jsonFetch(url,options){return fetch(url,options).then(function(response){return response.json().then(function(data){if(!response.ok){data.ok=false;}return data;});});}function ping(){if(document.visibilityState&&document.visibilityState!=="visible")return;jsonFetch("/chat/"+id+"?action=presence",{method:"POST",cache:"no-store",credentials:"same-origin"}).then(function(data){if(data.exists===false){window.location.href="/chat/"+id;return;}renderPresence(data);}).catch(function(){});}function refreshMessages(force){jsonFetch("/chat/"+id+"?action=messages",{cache:"no-store",credentials:"same-origin",headers:{Accept:"application/json"}}).then(function(data){if(data.exists===false){window.location.href="/chat/"+id;return;}renderMessages(data,force);}).catch(function(){});}function hasFile(){return fileInput&&fileInput.files&&fileInput.files.length>0;}function submitMessage(event){event.preventDefault();if(!form||!textarea)return;var body=textarea.value.trim();if(body===""&&!hasFile())return;if(hasFile()&&fileInput.files[0].size>8388608){alert("file is too big. max size is 8 MB.");return;}var payload=new FormData(form);textarea.disabled=true;if(fileInput)fileInput.disabled=true;if(sendButton)sendButton.disabled=true;jsonFetch(form.getAttribute("action")||("/chat/"+id),{method:"POST",body:payload,credentials:"same-origin",headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest"}}).then(function(data){if(data.exists===false){window.location.href="/chat/"+id;return;}if(data.ok){textarea.value="";if(fileInput)fileInput.value="";syncFileIndicator();renderMessages(data,true);}else if(data.error){alert(data.error);}}).catch(function(){form.submit();}).finally(function(){textarea.disabled=false;if(fileInput)fileInput.disabled=false;if(sendButton)sendButton.disabled=false;textarea.focus();});}if(form&&textarea){form.addEventListener("submit",submitMessage);textarea.addEventListener("keydown",function(event){if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();if(form.requestSubmit){form.requestSubmit();}else{submitMessage(event);}}});}if(fileInput){fileInput.addEventListener("change",syncFileIndicator);syncFileIndicator();}setInterval(function(){jsonFetch("/chat/"+id+"?action=status",{cache:"no-store"}).then(function(data){if(!data.exists){window.location.href="/chat/"+id;}}).catch(function(){});},5000);document.addEventListener("visibilitychange",function(){ping();refreshMessages(false);});scrollMessages(true);ping();refreshMessages(true);setInterval(ping,5000);setInterval(function(){refreshMessages(false);},2000);}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",initChat);}else{initChat();}}());</script>'
        . '</section>';

    chat_render_page('private chat', $description, $content);
    exit;
}

$createdId = preg_replace('/[^a-z0-9]/', '', strtolower((string)($_GET['created'] ?? '')));
if (!is_string($createdId) || !chat_is_valid_conversation_id($createdId)) {
    $createdId = '';
}
$error = trim((string)($_GET['error'] ?? ''));
$deleted = isset($_GET['deleted']);
$conversations = chat_load_all_conversations($chatDataDir, $chatKeyPath);
$cards = [];

foreach ($conversations as $conversation) {
    $id = (string)($conversation['id'] ?? '');
    if (!chat_is_valid_conversation_id($id)) {
        continue;
    }

    $shareUrl = '/chat/' . $id;
    $claimed = !empty($conversation['participantHash']);
    $messageCount = count((array)($conversation['messages'] ?? []));
    $cards[] = '<article class="chat-admin-card">'
        . '<div><strong>' . chat_h((string)($conversation['name'] ?? 'private chat')) . '</strong>'
        . '<span>' . chat_h($shareUrl) . '</span>'
        . '<span>' . chat_h($claimed ? 'claimed' : 'unclaimed') . ' · ' . $messageCount . ' message(s) · created ' . chat_h(date('Y-m-d H:i', (int)($conversation['createdAt'] ?? time()))) . '</span></div>'
        . '<div class="chat-card-actions"><a id="two-buttons" href="' . chat_h($shareUrl) . '">open</a>'
        . '<form method="post" action="' . chat_h($shareUrl) . '" data-no-spa="1" onsubmit="return confirm(\'end this conversation and delete all messages?\')"><input type="hidden" name="action" value="delete"><button class="danger-button" type="submit">delete</button></form></div>'
        . '</article>';
}

$contentPath = __DIR__ . DIRECTORY_SEPARATOR . 'content.html';
$content = (string)file_get_contents($contentPath);
$createdNotice = '';
if ($createdId !== '') {
    $url = '/chat/' . $createdId;
    $createdNotice = '<div id="result">chat created. share this one-time link:<br><pre><code>' . chat_h($url) . '</code></pre></div><br>';
}
if ($deleted) {
    $createdNotice = '<div id="result">conversation ended and deleted.</div><br>';
}
if ($error !== '') {
    $createdNotice = '<div id="error">' . chat_h($error) . '</div><br>';
}

$content = str_replace(
    ['{notice}', '{chat_count}', '{chat_cards}'],
    [
        $createdNotice,
        (string)count($conversations),
        $cards === [] ? '<p>no active conversations. very quiet. suspiciously peaceful.</p>' : implode('', $cards),
    ],
    $content
);

chat_render_page($title, $description, $content);
