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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$rootDir = dirname(__DIR__, 2);
$themes = function_exists('fridg3_list_themes') ? fridg3_list_themes($rootDir) : [];
$themeList = [];

foreach ($themes as $theme) {
    $themeList[] = [
        'id' => $theme['id'],
        'name' => $theme['name'],
    ];
}

$selected = function_exists('fridg3_get_preferred_theme_id')
    ? fridg3_get_preferred_theme_id($rootDir)
    : 'default';

echo json_encode([
    'ok' => true,
    'selected' => $selected,
    'themes' => $themeList,
], JSON_UNESCAPED_SLASHES);
exit;
