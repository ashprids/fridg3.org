<?php

session_start();

header('Content-Type: application/json');

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
    if (!is_file($accountsPath)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'accounts_missing']);
        exit;
    }

    $raw = @file_get_contents($accountsPath);
    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['accounts']) || !is_array($data['accounts'])) {
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
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json !== false) {
            if (@file_put_contents($accountsPath, $json) === false) {
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
