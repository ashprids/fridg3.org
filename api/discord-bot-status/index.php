<?php

header('Content-Type: application/json');

function find_template_file($filename) {
    $dir = __DIR__;
    $prev_dir = '';
    
    while ($dir !== $prev_dir) {
        $filepath = $dir . DIRECTORY_SEPARATOR . $filename;
        if (file_exists($filepath)) {
            return $filepath;
        }
        $prev_dir = $dir;
        $dir = dirname($dir);
    }
    
    return null;
}

// Read toast.json configuration
$config_path = find_template_file('data' . DIRECTORY_SEPARATOR . 'etc' . DIRECTORY_SEPARATOR . 'toast.json');
if (!$config_path) {
    http_response_code(500);
    echo json_encode(['error' => 'Configuration file not found']);
    exit;
}

$config = json_decode(file_get_contents($config_path), true);
if (!$config) {
    http_response_code(500);
    echo json_encode(['error' => 'Invalid configuration file']);
    exit;
}

// Read status updates from log file
$updates_path = find_template_file('data' . DIRECTORY_SEPARATOR . 'etc' . DIRECTORY_SEPARATOR . 'toast-updates.json');
$updates = [];

if ($updates_path && file_exists($updates_path)) {
    try {
        $updates_content = file_get_contents($updates_path);
        $updates_data = json_decode($updates_content, true);
        if (is_array($updates_data)) {
            // Sort by timestamp, newest first
            usort($updates_data, function($a, $b) {
                return strtotime($b['time']) - strtotime($a['time']);
            });
            $updates = array_slice($updates_data, 0, 20); // Keep last 20 updates
        }
    } catch (Exception $e) {
        // If file doesn't exist or is invalid, use empty array
        $updates = [];
    }
}

// If no updates, create default ones
if (empty($updates)) {
    $updates = [
        [
            'time' => date('Y-m-d H:i:s', time()),
            'status' => 'now playing ' . ($config['stream']['name'] ?? 'stream')
        ],
        [
            'time' => date('Y-m-d H:i:s', time() - 7200),
            'status' => 'radio stream online'
        ],
        [
            'time' => date('Y-m-d H:i:s', time() - 14400),
            'status' => 'chatbot initialized'
        ]
    ];
}

// Return bot status and stream info
$response = [
    'bot' => [
        'name' => 'Toast',
        'status' => $config['bot']['status'] ?? 'offline',
        'avatar' => 'https://cdn.discordapp.com/embed/avatars/0.png',
        'username' => 'toast#9266'
    ],
    'stream' => [
        'name' => $config['stream']['name'] ?? 'Unknown',
        'url' => $config['stream']['url'] ?? null,
        'playing' => true
    ],
    'updates' => $updates,
    'timestamp' => date('Y-m-d H:i:s')
];

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

?>
