<?php

function account_admin_find_template_file(string $filename): ?string {
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

function account_admin_accounts_path(): string {
    return dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
}

function account_admin_load_accounts(): array {
    $accountsPath = account_admin_accounts_path();
    if (!is_file($accountsPath)) {
        return ['accounts' => []];
    }

    $decoded = json_decode((string)@file_get_contents($accountsPath), true);
    if (!is_array($decoded)) {
        return ['accounts' => []];
    }

    if (!isset($decoded['accounts']) || !is_array($decoded['accounts'])) {
        $decoded['accounts'] = [];
    }

    return $decoded;
}

function account_admin_save_accounts(array $accountsData): bool {
    $encoded = json_encode($accountsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        return false;
    }

    return @file_put_contents(account_admin_accounts_path(), $encoded, LOCK_EX) !== false;
}

function account_admin_generate_password(int $length = 15): string {
    $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    $out = '';
    $max = strlen($chars) - 1;

    for ($i = 0; $i < $length; $i++) {
        $out .= $chars[random_int(0, $max)];
    }

    return $out;
}

function account_admin_is_list(array $value): bool {
    $expectedKey = 0;
    foreach ($value as $key => $_unused) {
        if ($key !== $expectedKey) {
            return false;
        }
        $expectedKey++;
    }

    return true;
}

function account_admin_require_admin(): void {
    if (!isset($_SESSION['user']) || !isset($_SESSION['user']['username'])) {
        header('Location: /account/login');
        exit;
    }

    $currentUsername = (string)$_SESSION['user']['username'];
    $accountsData = account_admin_load_accounts();
    $foundCurrentUser = false;

    foreach ($accountsData['accounts'] as $account) {
        if (!isset($account['username']) || (string)$account['username'] !== $currentUsername) {
            continue;
        }

        $foundCurrentUser = true;
        $_SESSION['user']['name'] = htmlspecialchars((string)($account['name'] ?? ''), ENT_QUOTES, 'UTF-8');
        $_SESSION['user']['isAdmin'] = (bool)($account['isAdmin'] ?? false);
        $_SESSION['user']['allowedPages'] = array_map(static function ($page) {
            return htmlspecialchars((string)$page, ENT_QUOTES, 'UTF-8');
        }, (array)($account['allowedPages'] ?? []));
        break;
    }

    if (!$foundCurrentUser || empty($_SESSION['user']['isAdmin'])) {
        http_response_code(403);
        echo '403 forbidden: admin access required';
        exit;
    }
}

function account_admin_render_page(string $title, string $description, string $content): void {
    $renderHelperPath = account_admin_find_template_file('lib/render.php');
    if ($renderHelperPath) {
        require_once $renderHelperPath;
    }

    $templateName = function_exists('get_preferred_template_name')
        ? get_preferred_template_name(__DIR__)
        : 'template.html';
    $templatePath = account_admin_find_template_file($templateName);
    if (!$templatePath && $templateName !== 'template.html') {
        $templatePath = account_admin_find_template_file('template.html');
    }
    if (!$templatePath) {
        die('page template not found. report this issue to me@fridg3.org.');
    }

    $template = (string)file_get_contents($templatePath);
    $html = str_replace('{content}', $content, $template);
    $html = str_replace('{title}', $title, $html);
    $html = str_replace('{description}', $description, $html);

    $userGreeting = '';
    if (isset($_SESSION['user']) && isset($_SESSION['user']['name'])) {
        $userGreeting = '<div id="user-greeting">Hello, ' . htmlspecialchars((string)$_SESSION['user']['name'], ENT_QUOTES, 'UTF-8') . '!</div>';
        $accountBtn = '<a href="/account"><div id="footer-button" data-tooltip="access your fridg3.org account"><i class="fa-solid fa-user"></i></div></a>';
        $logoutBtn = '<a href="/account/logout"><div id="footer-button" data-tooltip="log out"><i class="fa-solid fa-right-from-bracket"></i></div></a>';
        $html = str_replace($accountBtn, $logoutBtn, $html);
    }

    $html = str_replace('{user_greeting}', $userGreeting, $html);
    echo $html;
}
