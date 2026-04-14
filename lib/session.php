<?php

if (!function_exists('fridg3_get_persistent_login_lifetime')) {
    function fridg3_get_persistent_login_lifetime(): int
    {
        return 60 * 60 * 24 * 90;
    }
}

if (!function_exists('fridg3_start_session')) {
    function fridg3_start_session(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $persistentLoginLifetime = fridg3_get_persistent_login_lifetime();

        ini_set('session.cookie_httponly', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.cookie_samesite', 'Strict');
        ini_set('session.cookie_lifetime', (string)$persistentLoginLifetime);
        ini_set('session.gc_maxlifetime', (string)$persistentLoginLifetime);

        if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
            ini_set('session.cookie_secure', '1');
        }

        session_start();

        if (
            PHP_SAPI !== 'cli'
            && isset($_SESSION['user'])
            && !empty($_SESSION['user']['mustResetPassword'])
        ) {
            $requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
            $normalizedPath = rtrim($requestPath, '/');
            if ($normalizedPath === '') {
                $normalizedPath = '/';
            }

            $allowedPaths = [
                '/account/change-password',
                '/account/change-password/index.php',
                '/account/password',
                '/account/password/index.php',
                '/account/logout',
                '/account/logout/index.php',
            ];

            if (!in_array($normalizedPath, $allowedPaths, true)) {
                header('Location: /account/change-password?first_login=1');
                exit;
            }
        }
    }
}

if (!function_exists('fridg3_refresh_is_admin_cookie')) {
    function fridg3_refresh_is_admin_cookie(bool $isAdmin): void
    {
        $secureFlag = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';

        setcookie('is_admin', $isAdmin ? '1' : '0', [
            'expires' => time() + fridg3_get_persistent_login_lifetime(),
            'path' => '/',
            'secure' => $secureFlag,
            'httponly' => false,
            'samesite' => 'Lax'
        ]);
    }
}
