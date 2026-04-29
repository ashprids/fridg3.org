<?php

if (!function_exists('fridg3_find_relative_upward')) {
    function fridg3_find_relative_upward($startDir, $relativePath) {
        $dir = $startDir;
        $prevDir = '';

        while ($dir !== $prevDir) {
            $candidate = $dir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
            if (file_exists($candidate)) {
                return $candidate;
            }
            $prevDir = $dir;
            $dir = dirname($dir);
        }

        return null;
    }
}

if (!function_exists('fridg3_is_truthy_value')) {
    function fridg3_is_truthy_value($value) {
        if (is_bool($value)) {
            return $value;
        }
        if ($value === null) {
            return false;
        }

        $normalized = strtolower(trim((string)$value));
        return in_array($normalized, ['1', 'true', 'yes', 'y', 'on', 'enabled'], true);
    }
}

if (!function_exists('fridg3_get_mobile_cookie_domain')) {
    function fridg3_get_mobile_cookie_domain() {
        $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
        $host = preg_replace('/:\d+$/', '', $host);
        $isSubdomain = strlen($host) > strlen('.fridg3.org') && substr($host, -strlen('.fridg3.org')) === '.fridg3.org';
        if ($host === 'fridg3.org' || $host === 'm.fridg3.org' || $isSubdomain) {
            return '.fridg3.org';
        }
        return null;
    }
}

if (!function_exists('fridg3_get_account_mobile_preference')) {
    function fridg3_get_account_mobile_preference($startDir) {
        if (!isset($_SESSION['user']['username'])) {
            return null;
        }

        $accountsPath = fridg3_find_relative_upward($startDir, 'data/accounts/accounts.json');
        if (!$accountsPath || !is_file($accountsPath)) {
            return null;
        }

        $raw = @file_get_contents($accountsPath);
        if ($raw === false) {
            return null;
        }

        $data = json_decode($raw, true);
        if (!is_array($data) || !isset($data['accounts']) || !is_array($data['accounts'])) {
            return null;
        }

        $username = (string)$_SESSION['user']['username'];
        foreach ($data['accounts'] as $account) {
            if (!isset($account['username']) || (string)$account['username'] !== $username) {
                continue;
            }
            if (!array_key_exists('mobileFriendlyView', $account)) {
                return null;
            }
            return fridg3_is_truthy_value($account['mobileFriendlyView']);
        }

        return null;
    }
}

if (!function_exists('fridg3_normalize_theme_id')) {
    function fridg3_normalize_theme_id($theme) {
        $theme = strtolower(trim((string)$theme));
        if ($theme === '' || $theme === 'default') {
            return 'default';
        }
        if ($theme === 'custom') {
            return 'custom';
        }
        if (preg_match('/^[a-z0-9_-]+$/', $theme)) {
            return $theme;
        }
        return 'default';
    }
}

if (!function_exists('fridg3_list_themes')) {
    function fridg3_normalize_theme_asset_path($path) {
        $path = trim(str_replace('\\', '/', (string)$path));
        if ($path === '' || $path[0] === '/' || strpos($path, "\0") !== false) {
            return null;
        }

        $parts = [];
        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.' || $part === '..') {
                return null;
            }
            if (!preg_match('/^[a-zA-Z0-9._-]+$/', $part)) {
                return null;
            }
            $parts[] = $part;
        }

        return implode('/', $parts);
    }

    function fridg3_theme_asset_href($relativePath) {
        $parts = explode('/', $relativePath);
        $encoded = array_map('rawurlencode', $parts);
        return '/themes/lib/' . implode('/', $encoded);
    }

    function fridg3_list_themes($startDir) {
        $themesDir = fridg3_find_relative_upward($startDir, 'themes');
        $themesLibDir = fridg3_find_relative_upward($startDir, 'themes/lib');
        if (!$themesDir || !$themesLibDir || !is_dir($themesDir) || !is_dir($themesLibDir)) {
            return [];
        }

        $themes = [];
        $files = glob($themesDir . DIRECTORY_SEPARATOR . '*.json');
        if ($files === false) {
            return [];
        }

        foreach ($files as $file) {
            $id = fridg3_normalize_theme_id(pathinfo($file, PATHINFO_FILENAME));
            if ($id === 'default' || $id === 'custom') {
                continue;
            }

            $raw = @file_get_contents($file);
            if ($raw === false) {
                continue;
            }

            $meta = json_decode($raw, true);
            if (!is_array($meta)) {
                continue;
            }

            $name = trim((string)($meta['name'] ?? ''));
            $html = fridg3_normalize_theme_asset_path($meta['html'] ?? '');
            $css = fridg3_normalize_theme_asset_path($meta['css'] ?? '');
            if ($name === '' || $html === '' || $css === '') {
                continue;
            }

            $htmlPath = $themesLibDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $html);
            $cssPath = $themesLibDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $css);
            if (!is_file($htmlPath) || !is_file($cssPath)) {
                continue;
            }

            $themes[$id] = [
                'id' => $id,
                'name' => $name,
                'html' => $html,
                'css' => $css,
                'htmlPath' => $htmlPath,
                'cssPath' => $cssPath,
                'htmlTemplate' => 'themes/lib/' . $html,
                'cssHref' => fridg3_theme_asset_href($css) . '?v=' . (string)filemtime($cssPath),
            ];
        }

        uasort($themes, function($a, $b) {
            return strcasecmp($a['name'], $b['name']);
        });

        return $themes;
    }
}

if (!function_exists('fridg3_get_account_theme_preference')) {
    function fridg3_get_account_theme_preference($startDir) {
        if (!isset($_SESSION['user']['username'])) {
            return null;
        }

        $accountsPath = fridg3_find_relative_upward($startDir, 'data/accounts/accounts.json');
        if (!$accountsPath || !is_file($accountsPath)) {
            return null;
        }

        $raw = @file_get_contents($accountsPath);
        if ($raw === false) {
            return null;
        }

        $data = json_decode($raw, true);
        if (!is_array($data) || !isset($data['accounts']) || !is_array($data['accounts'])) {
            return null;
        }

        $username = (string)$_SESSION['user']['username'];
        foreach ($data['accounts'] as $account) {
            if (!isset($account['username']) || (string)$account['username'] !== $username) {
                continue;
            }
            if (!array_key_exists('theme', $account)) {
                return null;
            }
            return fridg3_normalize_theme_id($account['theme']);
        }

        return null;
    }
}

if (!function_exists('fridg3_get_theme_cookie_options')) {
    function fridg3_get_theme_cookie_options() {
        $options = [
            'expires' => time() + (86400 * 365),
            'path' => '/',
            'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'httponly' => false,
            'samesite' => 'Lax',
        ];

        $domain = fridg3_get_mobile_cookie_domain();
        if ($domain !== null) {
            $options['domain'] = $domain;
        }

        return $options;
    }
}

if (!function_exists('fridg3_get_preferred_theme_id')) {
    function fridg3_get_preferred_theme_id($startDir) {
        $accountTheme = fridg3_get_account_theme_preference($startDir);
        if ($accountTheme !== null) {
            return $accountTheme;
        }

        if (isset($_COOKIE['theme_pref'])) {
            return fridg3_normalize_theme_id($_COOKIE['theme_pref']);
        }

        return 'default';
    }
}

if (!function_exists('fridg3_get_active_theme')) {
    function fridg3_get_active_theme($startDir) {
        $themeId = fridg3_get_preferred_theme_id($startDir);
        if ($themeId === 'default' || $themeId === 'custom') {
            return null;
        }

        $themes = fridg3_list_themes($startDir);
        return $themes[$themeId] ?? null;
    }
}

if (!function_exists('should_use_mobile_template')) {
    function should_use_mobile_template($startDir) {
        $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
        $host = preg_replace('/:\d+$/', '', $host);
        if ($host === 'm.fridg3.org') {
            return true;
        }

        if (isset($_COOKIE['mobile_friendly_view']) && fridg3_is_truthy_value($_COOKIE['mobile_friendly_view'])) {
            return true;
        }

        $accountPreference = fridg3_get_account_mobile_preference($startDir);
        return $accountPreference === true;
    }
}

if (!function_exists('get_preferred_template_name')) {
    function get_preferred_template_name($startDir) {
        if (should_use_mobile_template($startDir)) {
            return 'template_mobile.html';
        }

        $theme = fridg3_get_active_theme($startDir);
        if ($theme !== null) {
            return $theme['htmlTemplate'];
        }

        return 'template.html';
    }
}

if (!function_exists('apply_preferred_theme_stylesheet')) {
    function apply_preferred_theme_stylesheet($template, $startDir) {
        $theme = fridg3_get_active_theme($startDir);
        if ($theme === null) {
            return $template;
        }

        $href = htmlspecialchars($theme['cssHref'], ENT_QUOTES, 'UTF-8');
        if (strpos($template, 'href="' . $href . '"') !== false || strpos($template, "href='" . $href . "'") !== false) {
            return $template;
        }

        $themeLink = '    <link rel="stylesheet" href="' . $href . '">' . "\n";
        if (stripos($template, '</head>') !== false) {
            return preg_replace('/<\/head>/i', $themeLink . '</head>', $template, 1);
        }

        return $themeLink . $template;
    }
}
