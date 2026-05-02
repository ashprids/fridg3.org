<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$baseDir = __DIR__;
$baseUrl = '/others/frdgbeats/samples/';
$extensions = ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac'];
$items = [];

foreach ($extensions as $extension) {
    foreach (glob($baseDir . '/*.' . $extension) ?: [] as $file) {
        if (!is_file($file)) {
            continue;
        }
        $filename = basename($file);
        if ($filename[0] === '.') {
            continue;
        }
        $name = preg_replace('/\.[^.]+$/', '', $filename);
        $name = trim(preg_replace('/[-_]+/', ' ', $name));
        $items[] = [
            'name' => $name !== '' ? $name : $filename,
            'filename' => $filename,
            'url' => $baseUrl . rawurlencode($filename),
        ];
    }
}

usort($items, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));
echo json_encode($items, JSON_UNESCAPED_SLASHES);
