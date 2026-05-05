<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$baseDir = __DIR__;
$baseUrl = '/others/frdgbeats/soundfonts/';
$items = [];

foreach (glob($baseDir . '/*.sf2') ?: [] as $file) {
    $filename = basename($file);
    if ($filename[0] === '.') {
        continue;
    }
    $items[] = [
        'name' => preg_replace('/\.sf2$/i', '', $filename),
        'filename' => $filename,
        'url' => $baseUrl . rawurlencode($filename),
    ];
}

usort($items, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));
echo json_encode($items, JSON_UNESCAPED_SLASHES);
