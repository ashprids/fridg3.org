<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$baseDir = __DIR__;
$baseUrl = '/others/fridgeBeats/presets/';
$items = [];

foreach (glob($baseDir . '/*.frdgbeats') ?: [] as $file) {
    if (!is_file($file)) {
        continue;
    }
    $filename = basename($file);
    if ($filename[0] === '.') {
        continue;
    }
    $name = '';
    $project = json_decode((string) file_get_contents($file), true);
    if (is_array($project) && isset($project['projectName']) && is_string($project['projectName'])) {
        $name = trim($project['projectName']);
    }
    if ($name === '') {
        $name = preg_replace('/\.frdgbeats$/i', '', $filename);
        $name = trim(preg_replace('/[-_]+/', ' ', $name));
    }
    $items[] = [
        'name' => $name !== '' ? $name : $filename,
        'filename' => $filename,
        'url' => $baseUrl . rawurlencode($filename),
    ];
}

usort($items, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));
echo json_encode($items, JSON_UNESCAPED_SLASHES);
