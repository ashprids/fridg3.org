<?php

session_start();

require_once __DIR__ . DIRECTORY_SEPARATOR . 'helpers.php';

account_admin_require_admin();

$title = 'manage accounts';
$description = 'manage and configure all made accounts.';

$accountsData = account_admin_load_accounts();
$cards = [];

foreach ($accountsData['accounts'] as $account) {
    $username = isset($account['username']) ? (string)$account['username'] : 'unknown';
    $name = isset($account['name']) ? (string)$account['name'] : '';
    $isAdmin = !empty($account['isAdmin']);
    $allowedPages = array_values(array_map('strval', (array)($account['allowedPages'] ?? [])));
    $tags = [];

    if ($isAdmin) {
        $tags[] = '<span class="account-admin-badge">admin</span>';
    }
    foreach ($allowedPages as $page) {
        $tags[] = '<span class="account-page-badge">' . htmlspecialchars($page, ENT_QUOTES, 'UTF-8') . '</span>';
    }

    $cards[] = '<a class="account-admin-card" href="/account/admin/edit?username='
        . rawurlencode($username)
        . '"><strong>@'
        . htmlspecialchars($username, ENT_QUOTES, 'UTF-8')
        . '</strong><span>'
        . htmlspecialchars($name, ENT_QUOTES, 'UTF-8')
        . '</span><span class="account-admin-meta">'
        . (empty($tags) ? 'no extra perms set' : implode('', $tags))
        . '</span></a>';
}

$contentPath = __DIR__ . DIRECTORY_SEPARATOR . 'content.html';
$content = (string)file_get_contents($contentPath);
$content = str_replace(
    ['{account_count}', '{account_cards}'],
    [
        (string)count($accountsData['accounts']),
        empty($cards) ? '<p>no accounts yet. kinda peaceful in here.</p>' : implode('', $cards),
    ],
    $content
);

account_admin_render_page($title, $description, $content);
