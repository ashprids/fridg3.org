<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$baseDir = __DIR__;
$baseUrl = '/others/fridgeBeats/synths/';
$items = [];

foreach (glob($baseDir . '/*.js') ?: [] as $file) {
    $name = basename($file);
    if ($name[0] === '.') {
        continue;
    }
    $items[] = [
        'name' => preg_replace('/\.js$/i', '', $name),
        'url' => $baseUrl . rawurlencode($name),
    ];
}

usort($items, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));
echo json_encode($items, JSON_UNESCAPED_SLASHES);
