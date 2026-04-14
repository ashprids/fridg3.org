<?php

if (!function_exists('fridg3_feed_find_root')) {
    function fridg3_feed_find_root(): string
    {
        return dirname(__DIR__);
    }
}

if (!function_exists('fridg3_feed_posts_dir')) {
    function fridg3_feed_posts_dir(): string
    {
        return fridg3_feed_find_root() . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'feed';
    }
}

if (!function_exists('fridg3_feed_replies_dir')) {
    function fridg3_feed_replies_dir(): string
    {
        return fridg3_feed_posts_dir() . DIRECTORY_SEPARATOR . 'replies';
    }
}

if (!function_exists('fridg3_feed_images_dir')) {
    function fridg3_feed_images_dir(): string
    {
        return fridg3_feed_find_root() . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'images';
    }
}

if (!function_exists('fridg3_feed_humanize_datetime')) {
    function fridg3_feed_humanize_datetime(string $dtStr): string
    {
        try {
            $dt = new DateTime($dtStr);
            $now = new DateTime('now');
            $diff = $now->getTimestamp() - $dt->getTimestamp();
            if ($diff < 60) return $diff . 's ago';
            if ($diff < 3600) return floor($diff / 60) . 'm ago';
            if ($diff < 86400) return floor($diff / 3600) . 'h ago';
            return $dt->format('Y-m-d');
        } catch (Exception $e) {
            return $dtStr;
        }
    }
}

if (!function_exists('fridg3_feed_accounts_path')) {
    function fridg3_feed_accounts_path(): string
    {
        return fridg3_feed_find_root() . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
    }
}

if (!function_exists('fridg3_feed_load_accounts')) {
    function fridg3_feed_load_accounts(): array
    {
        $accountsPath = fridg3_feed_accounts_path();
        if (!is_file($accountsPath)) {
            return ['accounts' => []];
        }

        $decoded = json_decode((string)@file_get_contents($accountsPath), true);
        if (!is_array($decoded) || !isset($decoded['accounts']) || !is_array($decoded['accounts'])) {
            return ['accounts' => []];
        }

        return $decoded;
    }
}

if (!function_exists('fridg3_feed_refresh_session_user')) {
    function fridg3_feed_refresh_session_user(): void
    {
        if (!isset($_SESSION['user']['username'])) {
            return;
        }

        $currentUsername = (string)$_SESSION['user']['username'];
        $accountsData = fridg3_feed_load_accounts();
        foreach ($accountsData['accounts'] as $account) {
            if (!isset($account['username']) || (string)$account['username'] !== $currentUsername) {
                continue;
            }

            $_SESSION['user']['name'] = htmlspecialchars((string)($account['name'] ?? ''), ENT_QUOTES, 'UTF-8');
            $_SESSION['user']['isAdmin'] = (bool)($account['isAdmin'] ?? false);
            $_SESSION['user']['allowedPages'] = array_map(static function ($page) {
                return htmlspecialchars((string)$page, ENT_QUOTES, 'UTF-8');
            }, (array)($account['allowedPages'] ?? []));
            break;
        }
    }
}

if (!function_exists('fridg3_feed_current_user_can_moderate_replies')) {
    function fridg3_feed_current_user_can_moderate_replies(string $postOwnerUsername): bool
    {
        if (!isset($_SESSION['user']['username'])) {
            return false;
        }

        $currentUsername = (string)$_SESSION['user']['username'];
        $isAdmin = !empty($_SESSION['user']['isAdmin']);
        $allowedPages = array_map('strval', (array)($_SESSION['user']['allowedPages'] ?? []));
        return $isAdmin
            || $currentUsername === ltrim($postOwnerUsername, '@')
            || in_array('comments', $allowedPages, true);
    }
}

if (!function_exists('fridg3_feed_current_user_can_manage_reply')) {
    function fridg3_feed_current_user_can_manage_reply(string $postOwnerUsername, string $replyUsername): bool
    {
        if (!isset($_SESSION['user']['username'])) {
            return false;
        }

        $currentUsername = (string)$_SESSION['user']['username'];
        return $currentUsername === ltrim($replyUsername, '@')
            || fridg3_feed_current_user_can_moderate_replies($postOwnerUsername);
    }
}

if (!function_exists('fridg3_feed_reply_fallback_id')) {
    function fridg3_feed_reply_fallback_id(array $reply, int $index): string
    {
        $seed = ($reply['username'] ?? '') . '|' . ($reply['date'] ?? '') . '|' . ($reply['body'] ?? '') . '|' . $index;
        return 'legacy_' . substr(sha1($seed), 0, 16);
    }
}

if (!function_exists('fridg3_feed_write_replies')) {
    function fridg3_feed_write_replies(string $postId, array $replies): bool
    {
        $safePostId = preg_replace('/[^a-zA-Z0-9_\-]/', '', basename($postId));
        if ($safePostId === '') {
            return false;
        }

        $repliesDir = fridg3_feed_replies_dir();
        if (!is_dir($repliesDir) && !@mkdir($repliesDir, 0777, true) && !is_dir($repliesDir)) {
            return false;
        }

        $payload = json_encode(['replies' => array_values($replies)], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($payload === false) {
            return false;
        }

        $replyFile = $repliesDir . DIRECTORY_SEPARATOR . $safePostId . '.json';
        return @file_put_contents($replyFile, $payload, LOCK_EX) !== false;
    }
}

if (!function_exists('fridg3_feed_load_replies')) {
    function fridg3_feed_load_replies(string $postId): array
    {
        $safePostId = preg_replace('/[^a-zA-Z0-9_\-]/', '', basename($postId));
        if ($safePostId === '') {
            return [];
        }

        $replyFile = fridg3_feed_replies_dir() . DIRECTORY_SEPARATOR . $safePostId . '.json';
        if (!is_file($replyFile)) {
            return [];
        }

        $json = @file_get_contents($replyFile);
        if ($json === false) {
            return [];
        }

        $decoded = json_decode($json, true);
        $replies = is_array($decoded['replies'] ?? null) ? $decoded['replies'] : [];

        $normalized = [];
        foreach ($replies as $index => $reply) {
            if (!is_array($reply)) {
                continue;
            }

            $username = isset($reply['username']) ? ltrim((string)$reply['username'], '@') : '';
            $date = isset($reply['date']) ? (string)$reply['date'] : '';
            $body = isset($reply['body']) ? (string)$reply['body'] : '';
            if ($username === '' || $date === '' || trim($body) === '') {
                continue;
            }

            $normalized[] = [
                'id' => isset($reply['id']) && (string)$reply['id'] !== ''
                    ? (string)$reply['id']
                    : fridg3_feed_reply_fallback_id($reply, $index),
                'username' => $username,
                'date' => $date,
                'body' => $body,
            ];
        }

        return $normalized;
    }
}

if (!function_exists('fridg3_feed_save_reply')) {
    function fridg3_feed_save_reply(string $postId, string $username, string $body): bool
    {
        $safePostId = preg_replace('/[^a-zA-Z0-9_\-]/', '', basename($postId));
        $safeUsername = preg_replace('/[^a-zA-Z0-9_\-]/', '', ltrim($username, '@'));
        $trimmedBody = trim($body);

        if ($safePostId === '' || $safeUsername === '' || $trimmedBody === '') {
            return false;
        }

        $repliesDir = fridg3_feed_replies_dir();
        if (!is_dir($repliesDir) && !@mkdir($repliesDir, 0777, true) && !is_dir($repliesDir)) {
            return false;
        }

        $replyFile = $repliesDir . DIRECTORY_SEPARATOR . $safePostId . '.json';
        $existingReplies = fridg3_feed_load_replies($safePostId);
        $existingReplies[] = [
            'id' => date('YmdHis') . '_' . bin2hex(random_bytes(4)),
            'username' => $safeUsername,
            'date' => date('Y-m-d H:i:s'),
            'body' => $trimmedBody,
        ];

        $payload = json_encode(['replies' => $existingReplies], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($payload === false) {
            return false;
        }

        return @file_put_contents($replyFile, $payload, LOCK_EX) !== false;
    }
}

if (!function_exists('fridg3_feed_update_reply')) {
    function fridg3_feed_update_reply(string $postId, string $replyId, string $body): bool
    {
        $trimmedBody = trim($body);
        if ($trimmedBody === '') {
            return false;
        }

        $replies = fridg3_feed_load_replies($postId);
        foreach ($replies as $index => $reply) {
            if (($reply['id'] ?? '') !== $replyId) {
                continue;
            }
            $replies[$index]['body'] = $trimmedBody;
            return fridg3_feed_write_replies($postId, $replies);
        }

        return false;
    }
}

if (!function_exists('fridg3_feed_delete_reply')) {
    function fridg3_feed_delete_reply(string $postId, string $replyId): bool
    {
        $replies = fridg3_feed_load_replies($postId);
        $updatedReplies = [];
        $deleted = false;

        foreach ($replies as $reply) {
            if (($reply['id'] ?? '') === $replyId) {
                $deleted = true;
                continue;
            }
            $updatedReplies[] = $reply;
        }

        if (!$deleted) {
            return false;
        }

        return fridg3_feed_write_replies($postId, $updatedReplies);
    }
}

if (!function_exists('fridg3_feed_save_jpeg_under_limit')) {
    function fridg3_feed_save_jpeg_under_limit(string $srcPath, string $mime, string $destPath, int $maxBytes = 1000000): bool
    {
        if (!function_exists('imagecreatetruecolor')) {
            return false;
        }

        $createMap = [
            'image/png' => function($p) { return @imagecreatefrompng($p); },
            'image/jpeg' => function($p) { return @imagecreatefromjpeg($p); },
            'image/gif' => function($p) { return function_exists('imagecreatefromgif') ? @imagecreatefromgif($p) : false; },
            'image/webp' => function($p) { return function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($p) : false; },
        ];

        if (!isset($createMap[$mime])) {
            return false;
        }

        $img = $createMap[$mime]($srcPath);
        if (!$img) {
            return false;
        }

        $width = imagesx($img);
        $height = imagesy($img);
        $canvas = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $white);
        imagecopy($canvas, $img, 0, 0, 0, 0, $width, $height);
        imagedestroy($img);

        $tmpPath = tempnam(sys_get_temp_dir(), 'img');
        if ($tmpPath === false) {
            imagedestroy($canvas);
            return false;
        }

        $quality = 90;
        do {
            imagejpeg($canvas, $tmpPath, $quality);
            $size = @filesize($tmpPath);
            if ($size !== false && $size <= $maxBytes) {
                break;
            }
            $quality -= 5;
        } while ($quality >= 40);

        imagedestroy($canvas);
        $finalSize = @filesize($tmpPath);
        if ($finalSize === false || $finalSize > $maxBytes) {
            @unlink($tmpPath);
            return false;
        }

        $moved = @rename($tmpPath, $destPath);
        if (!$moved) {
            @unlink($tmpPath);
        }

        return $moved;
    }
}

if (!function_exists('fridg3_feed_process_uploaded_images')) {
    function fridg3_feed_process_uploaded_images(array $files): array
    {
        $imagesDir = fridg3_feed_images_dir();
        if (!is_dir($imagesDir)) {
            @mkdir($imagesDir, 0777, true);
        }

        $imageMap = [];
        if (!isset($files['name']) || !is_array($files['name'])) {
            return $imageMap;
        }

        $allowed = [
            'image/png' => 'png',
            'image/jpeg' => 'jpg',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
        ];

        $count = count($files['name']);
        for ($i = 0; $i < $count; $i++) {
            $error = $files['error'][$i] ?? UPLOAD_ERR_NO_FILE;
            if ($error !== UPLOAD_ERR_OK) {
                continue;
            }

            $tmpPath = $files['tmp_name'][$i] ?? '';
            $origName = $files['name'][$i] ?? ('image_' . $i);
            if ($tmpPath === '') {
                continue;
            }

            $imageInfo = @getimagesize($tmpPath);
            $mime = is_array($imageInfo) && isset($imageInfo['mime']) ? $imageInfo['mime'] : '';
            if (!isset($allowed[$mime])) {
                continue;
            }

            $ext = $allowed[$mime];
            $sizeBytes = @filesize($tmpPath) ?: 0;
            $mustJpeg = ($mime === 'image/png');
            $mustCompress = $mustJpeg || ($sizeBytes > 1000000);
            $randomBase = bin2hex(random_bytes(8));
            $destExt = $mustCompress ? 'jpg' : $ext;
            $destName = $randomBase . '.' . $destExt;
            $destPath = $imagesDir . DIRECTORY_SEPARATOR . $destName;

            $saved = false;
            if ($mustCompress) {
                $saved = fridg3_feed_save_jpeg_under_limit($tmpPath, $mime, $destPath, 1000000);
            } else {
                $saved = @move_uploaded_file($tmpPath, $destPath);
            }

            $finalSize = $saved ? (@filesize($destPath) ?: 0) : 0;
            if (!$saved || $finalSize > 1000000) {
                @unlink($destPath);
                $destName = $randomBase . '.jpg';
                $destPath = $imagesDir . DIRECTORY_SEPARATOR . $destName;
                $saved = fridg3_feed_save_jpeg_under_limit($tmpPath, $mime, $destPath, 1000000);
            }

            if ($saved) {
                $imageMap[$i] = [
                    'url' => '/data/images/' . $destName,
                    'name' => $origName ?: $destName,
                ];
            }
        }

        return $imageMap;
    }
}

if (!function_exists('fridg3_feed_replace_image_placeholders')) {
    function fridg3_feed_replace_image_placeholders(string $content, array $imageMap): string
    {
        if (empty($imageMap)) {
            return $content;
        }

        return (string)preg_replace_callback('/\[img:(\d+)\](?:\[name:([^\]]*)\])?/i', function($m) use ($imageMap) {
            $idx = (int)$m[1];
            if (!isset($imageMap[$idx])) {
                return $m[0];
            }
            $name = isset($m[2]) && strlen(trim($m[2])) ? trim($m[2]) : ($imageMap[$idx]['name'] ?? 'image');
            return '[img=' . $imageMap[$idx]['url'] . '][name:' . $name . ']';
        }, $content);
    }
}
