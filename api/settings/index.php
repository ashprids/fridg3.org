<?php

session_start();

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
            'glowIntensity' => null,
            'colors' => null,
        ],
    ];
    foreach ($data['accounts'] as $account) {
        if (isset($account['username']) && (string)$account['username'] === $username) {
            if (isset($account['glowIntensity'])) {
                $result['settings']['glowIntensity'] = $account['glowIntensity'];
            }
            if (isset($account['colors']) && is_array($account['colors'])) {
                $result['settings']['colors'] = $account['colors'];
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

$maintenanceProvided = array_key_exists('maintenanceMode', $_POST);
$maintenanceRaw = $maintenanceProvided ? (string)$_POST['maintenanceMode'] : null;

$allowedIntensity = ['none', 'low', 'medium', 'high'];
$colorFields = ['bg', 'fg', 'border', 'subtle', 'links'];

$errors = [];
$didWork = false;

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

if ($intensityProvided || $maintenanceProvided) {
    echo json_encode(['ok' => true]);
    exit;
}

// Nothing to do
http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'no_updates']);
exit;
