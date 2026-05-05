<?php

$sessionBootstrapDir = __DIR__;
while (!file_exists($sessionBootstrapDir . "/lib/session.php") && dirname($sessionBootstrapDir) !== $sessionBootstrapDir) {
    $sessionBootstrapDir = dirname($sessionBootstrapDir);
}
require_once $sessionBootstrapDir . "/lib/session.php";
fridg3_start_session();

$renderHelperPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'lib' . DIRECTORY_SEPARATOR . 'render.php';
if (is_file($renderHelperPath)) {
    require_once $renderHelperPath;
}

header('Content-Type: application/json');

// Helper to load accounts data
function load_accounts_data($accountsPath) {
    if (!is_file($accountsPath)) {
        return null;
    }
    $raw = @file_get_contents($accountsPath);
    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['accounts']) || !is_array($data['accounts'])) {
        return null;
    }
    return $data;
}

function save_accounts_data($accountsPath, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) return false;
    return @file_put_contents($accountsPath, $json) !== false;
}

function is_truthy_setting($value) {
    if (is_bool($value)) {
        return $value;
    }
    if ($value === null) {
        return false;
    }
    $normalized = strtolower(trim((string)$value));
    return in_array($normalized, ['1', 'true', 'yes', 'y', 'on', 'enabled'], true);
}

function get_mobile_cookie_options() {
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $host = preg_replace('/:\d+$/', '', $host);
    $isSubdomain = strlen($host) > strlen('.fridg3.org') && substr($host, -strlen('.fridg3.org')) === '.fridg3.org';
    $options = [
        'expires' => time() + (86400 * 365),
        'path' => '/',
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
        'httponly' => false,
        'samesite' => 'Lax',
    ];

    if ($host === 'fridg3.org' || $host === 'm.fridg3.org' || $isSubdomain) {
        $options['domain'] = '.fridg3.org';
    }

    return $options;
}

// Allow GET to fetch current user settings
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_SESSION['user']) || !isset($_SESSION['user']['username'])) {
        echo json_encode(['ok' => false, 'error' => 'not_logged_in']);
        exit;
    }
    $username = (string)$_SESSION['user']['username'];
    $accountsPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
    $data = load_accounts_data($accountsPath);
    if ($data === null) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'accounts_invalid']);
        exit;
    }
    $result = [
        'ok' => true,
        'settings' => [
            'theme' => 'default',
            'glowIntensity' => null,
            'colors' => null,
            'mobileFriendlyView' => null,
        ],
    ];
    foreach ($data['accounts'] as $account) {
        if (isset($account['username']) && (string)$account['username'] === $username) {
            if (isset($account['glowIntensity'])) {
                $result['settings']['glowIntensity'] = $account['glowIntensity'];
            }
            if (isset($account['theme'])) {
                $result['settings']['theme'] = function_exists('fridg3_normalize_theme_id')
                    ? fridg3_normalize_theme_id($account['theme'])
                    : ($account['theme'] === 'custom' ? 'custom' : 'default');
            }
            if (isset($account['colors']) && is_array($account['colors'])) {
                $result['settings']['colors'] = $account['colors'];
            }
            if (array_key_exists('mobileFriendlyView', $account)) {
                $result['settings']['mobileFriendlyView'] = is_truthy_setting($account['mobileFriendlyView']);
            }
            break;
        }
    }
    echo json_encode($result, JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

if (!isset($_SESSION['user']) || !isset($_SESSION['user']['username'])) {
    // Not logged in; nothing to persist server-side
    echo json_encode(['ok' => false, 'error' => 'not_logged_in']);
    exit;
}

$username = (string)$_SESSION['user']['username'];
$isAdmin = isset($_SESSION['user']['isAdmin']) && $_SESSION['user']['isAdmin'] === true;

$intensityProvided = array_key_exists('glowIntensity', $_POST);
$intensity = $intensityProvided ? (string)$_POST['glowIntensity'] : null;

$themeProvided = array_key_exists('theme', $_POST);
$theme = $themeProvided ? (string)$_POST['theme'] : null;

$maintenanceProvided = array_key_exists('maintenanceMode', $_POST);
$maintenanceRaw = $maintenanceProvided ? (string)$_POST['maintenanceMode'] : null;

$mobileViewProvided = array_key_exists('mobileFriendlyView', $_POST);
$mobileViewRaw = $mobileViewProvided ? (string)$_POST['mobileFriendlyView'] : null;

$allowedIntensity = ['none', 'low', 'medium', 'high'];
$availableThemes = function_exists('fridg3_list_themes') ? fridg3_list_themes(dirname(__DIR__, 2)) : [];
$allowedThemes = array_merge(['default', 'custom'], array_keys($availableThemes));
$colorFields = ['bg', 'fg', 'border', 'subtle', 'links'];

$errors = [];
$didWork = false;

if ($mobileViewProvided) {
    $truthy = ['1', 'true', 'yes', 'y', 'on', 'enabled'];
    $falsy  = ['0', 'false', 'no', 'n', 'off', 'disabled'];
    $lower = strtolower(trim((string)$mobileViewRaw));
    if (!in_array($lower, $truthy, true) && !in_array($lower, $falsy, true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_mobile_view_value']);
        exit;
    }

    $mobileEnabled = in_array($lower, $truthy, true);
    setcookie('mobile_friendly_view', $mobileEnabled ? '1' : '0', get_mobile_cookie_options());
    $_COOKIE['mobile_friendly_view'] = $mobileEnabled ? '1' : '0';

    $accountsPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
    $data = load_accounts_data($accountsPath);
    if ($data === null) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'accounts_invalid']);
        exit;
    }

    $updated = false;
    foreach ($data['accounts'] as &$account) {
        if (isset($account['username']) && (string)$account['username'] === $username) {
            $account['mobileFriendlyView'] = $mobileEnabled;
            $updated = true;
            break;
        }
    }
    unset($account);

    if ($updated) {
        if (!save_accounts_data($accountsPath, $data)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'write_failed']);
            exit;
        }
        $didWork = true;
    }
}

// Handle theme update (per-user)
if ($themeProvided) {
    $theme = function_exists('fridg3_normalize_theme_id') ? fridg3_normalize_theme_id($theme) : (string)$theme;
    if (!in_array($theme, $allowedThemes, true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_theme']);
        exit;
    }

    if (function_exists('fridg3_get_theme_cookie_options')) {
        setcookie('theme_pref', $theme, fridg3_get_theme_cookie_options());
        $_COOKIE['theme_pref'] = $theme;
    }

    $accountsPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
    $data = load_accounts_data($accountsPath);
    if ($data === null) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'accounts_invalid']);
        exit;
    }

    $updated = false;
    foreach ($data['accounts'] as &$account) {
        if (isset($account['username']) && (string)$account['username'] === $username) {
            $account['theme'] = $theme;
            $updated = true;
            break;
        }
    }
    unset($account);

    if ($updated) {
        if (!save_accounts_data($accountsPath, $data)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'write_failed']);
            exit;
        }
        $didWork = true;
    }
}

// Handle glow intensity update (per-user)
if ($intensityProvided) {
    if (!in_array($intensity, $allowedIntensity, true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_intensity']);
        exit;
    }

    $accountsPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
    $data = load_accounts_data($accountsPath);
    if ($data === null) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'accounts_invalid']);
        exit;
    }

    $updated = false;
    foreach ($data['accounts'] as &$account) {
        if (isset($account['username']) && (string)$account['username'] === $username) {
            $account['glowIntensity'] = $intensity;
            $updated = true;
            break;
        }
    }
    unset($account);

    if ($updated) {
        if (!save_accounts_data($accountsPath, $data)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'write_failed']);
            exit;
        }
        $didWork = true;
    }
}

// Handle color scheme update (per-user)
// Expect hex strings (#RRGGBB) for provided fields
if (!empty($_POST['colors']) && is_array($_POST['colors'])) {
    $colors = $_POST['colors'];
} else {
    // Accept flat fields colorBg, colorFg, etc.
    $colors = [];
    foreach ($colorFields as $field) {
        $key = 'color' . ucfirst($field);
        if (isset($_POST[$key])) {
            $colors[$field] = (string)$_POST[$key];
        }
    }
}

if (!empty($colors)) {
    $validColors = [];
    foreach ($colors as $k => $v) {
        if (!in_array($k, $colorFields, true)) continue;
        $hex = trim((string)$v);
        if (!preg_match('/^#([0-9a-fA-F]{6})$/', $hex)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_color_' . $k]);
            exit;
        }
        $validColors[$k] = strtoupper($hex);
    }

    if (!empty($validColors)) {
        $accountsPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
        $data = load_accounts_data($accountsPath);
        if ($data === null) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'accounts_invalid']);
            exit;
        }
        $updated = false;
        foreach ($data['accounts'] as &$account) {
            if (isset($account['username']) && (string)$account['username'] === $username) {
                $account['colors'] = array_merge($account['colors'] ?? [], $validColors);
                $updated = true;
                break;
            }
        }
        unset($account);

        if ($updated) {
            if (!save_accounts_data($accountsPath, $data)) {
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => 'write_failed']);
                exit;
            }
            $didWork = true;
        }
    }
}

// Handle maintenance mode toggle (admin only)
if ($maintenanceProvided) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'forbidden']);
        exit;
    }

    $truthy = ['1', 'true', 'yes', 'y', 'on', 'enabled'];
    $falsy  = ['0', 'false', 'no', 'n', 'off', 'disabled'];
    $lower = strtolower(trim((string)$maintenanceRaw));
    if (!in_array($lower, $truthy, true) && !in_array($lower, $falsy, true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_maintenance_value']);
        exit;
    }
    $enabled = in_array($lower, $truthy, true);

    $etcDir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'etc';
    if (!is_dir($etcDir)) {
        @mkdir($etcDir, 0775, true);
    }
    $wipPath = $etcDir . DIRECTORY_SEPARATOR . 'wip';
    if (@file_put_contents($wipPath, $enabled ? 'true' : 'false') === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'wip_write_failed']);
        exit;
    }
    $didWork = true;
}

if ($didWork || $intensityProvided || $themeProvided || $maintenanceProvided || $mobileViewProvided) {
    echo json_encode(['ok' => true]);
    exit;
}

// Nothing to do
http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'no_updates']);
exit;
