<?php

header('Content-Type: application/json; charset=utf-8');

$demos = [];
$basePath = __DIR__;
$baseUrl = '/others/frdgbeats/demos/';

foreach (glob($basePath . '/*.frdgbeats') ?: [] as $path) {
    if (!is_file($path)) {
        continue;
    }
    $filename = basename($path);
    $name = '';
    $project = json_decode((string) file_get_contents($path), true);
    if (is_array($project) && isset($project['projectName']) && is_string($project['projectName'])) {
        $name = trim($project['projectName']);
    }
    if ($name === '') {
        $name = preg_replace('/\.frdgbeats$/i', '', $filename);
        $name = trim(preg_replace('/[-_]+/', ' ', $name));
    }
    $demos[] = [
        'name' => $name !== '' ? $name : $filename,
        'url' => $baseUrl . rawurlencode($filename),
    ];
}

usort($demos, fn($a, $b) => strcasecmp($a['name'], $b['name']));

echo json_encode($demos, JSON_UNESCAPED_SLASHES);
