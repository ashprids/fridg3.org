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
        return should_use_mobile_template($startDir) ? 'template_mobile.html' : 'template.html';
    }
}
