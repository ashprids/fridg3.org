<?php

session_start();

$title = 'music';
$description = 'songs made or published by fridg3.org';


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

$template_path = find_template_file('template.html');
if (!$template_path) {
    die('template.html not found. report this issue to me@fridg3.org.');
}

$template = file_get_contents($template_path);

// Generate user greeting if logged in
$user_greeting = '';
if (isset($_SESSION['user'])) {
    $user_name = htmlspecialchars($_SESSION['user']['name'], ENT_QUOTES, 'UTF-8');
    $user_greeting = '<div id="user-greeting">Hello, ' . $user_name . '!</div>';
    
    // Swap Account button to Logout
    $accountBtn = '<a href="/account"><div id="footer-button" data-tooltip="access your fridg3.org account"><i class="fa-solid fa-user"></i></div></a>';
    $logoutBtn = '<a href="/account/logout"><div id="footer-button" data-tooltip="log out"><i class="fa-solid fa-arrow-right-from-bracket"></i></div></a>';
    $template = str_replace($accountBtn, $logoutBtn, $template);
}

// Replace user greeting placeholder
$template = str_replace('{user_greeting}', $user_greeting, $template);

$content_path = find_template_file('content.html');
if (!$content_path) {
    die('content.html not found. report this issue to me@fridg3.org.');
}

$content = file_get_contents($content_path);

// Helper to build an album grid from a folder of JSON files
function build_album_grid($folder) {
    // Use new data/music path for frdg3 and cactile
    if ($folder === 'frdg3' || $folder === 'cactile') {
        $albums_dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'music' . DIRECTORY_SEPARATOR . $folder;
    } else {
        $albums_dir = __DIR__ . DIRECTORY_SEPARATOR . $folder;
    }

    // Derive artist name from folder
    $artist = '';
    if ($folder === 'frdg3') {
        $artist = 'frdg3';
    } elseif ($folder === 'cactile') {
        $artist = 'Cactile';
    }

    if (!is_dir($albums_dir)) {
        return '';
    }

    $album_files = glob($albums_dir . DIRECTORY_SEPARATOR . '*.json');

    $albums = [];

    foreach ($album_files as $album_file) {
        $json = file_get_contents($album_file);
        $data = json_decode($json, true);

        if (!is_array($data)) {
            continue;
        }

        $album_name = htmlspecialchars($data['album_name'] ?? basename($album_file, '.json'), ENT_QUOTES, 'UTF-8');
        $album_caption = htmlspecialchars($data['album_caption'] ?? '', ENT_QUOTES, 'UTF-8');
        $album_type = htmlspecialchars($data['album_type'] ?? '', ENT_QUOTES, 'UTF-8');
        // Support both "album_art_directory" (preferred) and legacy "album_art" keys
        $album_art_value = $data['album_art_directory'] ?? ($data['album_art'] ?? '');
        $album_art = htmlspecialchars($album_art_value, ENT_QUOTES, 'UTF-8');

        // Songs array (used by mini player)
        $songs = (isset($data['songs']) && is_array($data['songs'])) ? $data['songs'] : [];
        $songs_json = htmlspecialchars(json_encode($songs), ENT_QUOTES, 'UTF-8');

        // Order: higher numbers appear first, 1 is last
        $order = isset($data['order']) ? (int)$data['order'] : 0;

        $albums[] = [
            'order' => $order,
            'name' => $album_name,
            'caption' => $album_caption,
            'type' => $album_type,
            'art' => $album_art,
            'songs' => $songs_json,
            'artist' => $artist,
        ];
    }

    // Sort albums by order (desc), then by name for stability
    usort($albums, function ($a, $b) {
        if ($a['order'] === $b['order']) {
            return strcmp($a['name'], $b['name']);
        }
        return $b['order'] <=> $a['order'];
    });

    $grid_html = '';
    foreach ($albums as $album) {
        $grid_html .= '<a href="#" class="album-link"'
            . ' data-album-name="' . $album['name'] . '"'
            . ' data-album-type="' . $album['type'] . '"'
            . ' data-album-art="' . $album['art'] . '"'
            . ' data-album-artist="' . $album['artist'] . '"'
            . ' data-album-tracks="' . $album['songs'] . '">'
            . '<div class="grid-item">'
            . '<img class="grid-image" src="' . $album['art'] . '" alt="' . $album['name'] . '">' 
            . '<div class="grid-caption">' . $album['name'] . '</div>'
            . '<div class="grid-subcaption">' . $album['type'] . '<br>' . $album['caption'] . '</div>'
            . '</div></a>';
    }

    return $grid_html;
}

// Build grids
$frdg3_grid_html = build_album_grid('frdg3');
$cactile_grid_html = build_album_grid('cactile');

// Inject generated grids into placeholders in content.html
$content = str_replace('{frdg3_grid}', $frdg3_grid_html, $content);
$content = str_replace('{cactile_grid}', $cactile_grid_html, $content);

$html = str_replace('{content}', $content, $template);
$html = str_replace('{title}', $title, $html);
$html = str_replace('{description}', $description, $html);
echo $html;
?>
    