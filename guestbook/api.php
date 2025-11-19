<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/_storage.php';

$method = $_SERVER['REQUEST_METHOD'];

// Helper: try to find a color mapping for an ip-hash or raw ip. This handles
// legacy cases where keys may be SHA1(ip) or raw IPs.
function find_color_for_iphash($colors, $ip_hash) {
    if (!is_array($colors) || $ip_hash === '') return '';
    if (isset($colors[$ip_hash])) return (int)$colors[$ip_hash];
    $maybe = sha1($ip_hash);
    if (isset($colors[$maybe])) return (int)$colors[$maybe];
    // try reverse: if a stored key's sha1 equals the ip_hash
    foreach ($colors as $k => $v) {
        if (!is_string($k)) continue;
        if (sha1($k) === $ip_hash) return (int)$v;
    }
    return '';
}

// Map a color name (e.g. "blue") or numeric string to an index (1..8).
function map_color_name_to_index($val) {
    if ($val === null) return 0;
    if (is_int($val)) $v = $val;
    else $v = trim((string)$val);
    if ($v === '') return 0;
    // if it's numeric, coerce
    if (is_string($v) && preg_match('/^\d+$/', $v)) {
        $n = (int)$v;
        if ($n >= 1 && $n <= 8) return $n;
        return 0;
    }
    $m = strtolower((string)$v);
    $names = ['red'=>1,'orange'=>2,'yellow'=>3,'green'=>4,'teal'=>5,'blue'=>6,'purple'=>7,'pink'=>8];
    return $names[$m] ?? 0;
}

if ($method === 'GET') {
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
    if ($limit <= 0 || $limit > 1000) $limit = 100;
    $messages = read_messages($limit);
    // attach color per-message based on IP-hash mapping
    $colors = read_colors();
    foreach ($messages as &$m) {
        $m['color'] = '';
        if (!empty($m['ip_hash'])) {
            $col = find_color_for_iphash($colors, $m['ip_hash']);
            if ($col !== '') $m['color'] = $col;
        }
    }
    unset($m);
    // report whether the caller already has a reserved name (so the client
    // does not need to persist the name locally)
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $reserved = '';
    // Prefer token-based reservation lookup if client sent a gb_token cookie
    $token = $_COOKIE['gb_token'] ?? '';
    if ($token) {
        $reserved = get_reserved_name_for_token($token);
    }
    if ($reserved === '' && $ip !== '') {
        $reserved = get_reserved_name_for_ip($ip);
    }

    $out = ['ok' => true, 'messages' => $messages, 'reserved_name' => $reserved];
    if (!empty($_GET['include_colors'])) {
        $out['colors'] = $colors;
    }
    // events removed
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    // get client IP
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    // token from cookie (if present)
    $token = $_COOKIE['gb_token'] ?? '';

    if (!check_rate_limit($ip)) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => 'rate_limited']);
        exit;
    }

    // Accept JSON or form data
    $input = null;
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos($ct, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true);
    } else {
        $input = $_POST;
    }

    // quick action: set_color (store mapping keyed by caller IP)
    if (!empty($input['action']) && $input['action'] === 'set_color') {
        // color may be a name like "blue" or a numeric index
        $setIdx = map_color_name_to_index($input['color'] ?? '');
        if ($setIdx < 1 || $setIdx > 8) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_color']);
            exit;
        }
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        if ($ip === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'no_ip']);
            exit;
        }
        $ok = set_color_by_ip($ip, $setIdx);
        if (!$ok) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'color_write_failed']);
            exit;
        }
        echo json_encode(['ok' => true, 'color' => $setIdx], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // quick action: set_name (reserve a username for 30 days tied to caller IP)
    if (!empty($input['action']) && $input['action'] === 'set_name') {
        $newName = trim($input['new_name'] ?? '');
        if ($newName === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_name']);
            exit;
        }
        // Check against prohibited words
        if (text_contains_badword($newName)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'name_forbidden']);
            exit;
        }
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        if ($ip === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'no_ip']);
            exit;
        }
        // token from cookie (if present)
        $token = $_COOKIE['gb_token'] ?? '';
        // basic sanitization
        $newName = strip_tags($newName);
        $newName = preg_replace('/[\x00-\x1F\x7F]/u', '', $newName);
    if (mb_strlen($newName) > 15) $newName = mb_substr($newName, 0, 15);

        $key = mb_strtolower($newName);
        $map = read_name_reservations();
        $now = time();
        if (isset($map[$key]) && isset($map[$key]['expires']) && (int)$map[$key]['expires'] > $now) {
            $rec = $map[$key];
            // If the reservation is already owned by this token, allow renew.
            if ($token && isset($rec['token']) && $rec['token'] === $token) {
                // allow
            } elseif (!isset($rec['ip_hash']) || !ip_matches($rec['ip_hash'], $ip)) {
                // name is reserved by someone else
                http_response_code(409);
                echo json_encode(['ok' => false, 'error' => 'name_taken', 'expires' => $rec['expires']]);
                exit;
            }
            // else it's already reserved by this IP; renew
        }

        // generate a token for this reservation (32 bytes -> 64 hex chars)
        try {
            $newToken = bin2hex(random_bytes(32));
        } catch (Exception $e) {
            // fallback to less-preferred pseudo-random
            $newToken = bin2hex(uniqid('', true));
        }

        $expires = set_name_reservation($newName, $ip, 30, $newToken);
        if (!$expires) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'reserve_failed']);
            exit;
        }
        // Set cookie for the token so subsequent requests authenticate via cookie
        $cookieOpts = ['expires' => $expires, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax'];
        if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') $cookieOpts['secure'] = true;
        if (PHP_VERSION_ID >= 70300) {
            setcookie('gb_token', $newToken, $cookieOpts);
        } else {
            // fallback formatting (no SameSite support in older PHP versions)
            $secure = (!empty($cookieOpts['secure']) && $cookieOpts['secure']) ? 1 : 0;
            setcookie('gb_token', $newToken, (int)$cookieOpts['expires'], $cookieOpts['path'], '', $secure, true);
        }

        echo json_encode(['ok' => true, 'name' => $newName, 'expires' => $expires], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // nickname changes removed: clients should not POST action=set_nick

    $name = trim($input['name'] ?? ($input['nick'] ?? ''));
    $message = trim($input['message'] ?? ($input['text'] ?? ''));

    // require a username reservation before accepting messages
    if ($name === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'no_name', 'message' => 'Set a username first']);
        exit;
    }
    // check message and name for prohibited words
    if (text_contains_badword($name)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'name_forbidden']);
        exit;
    }
    if ($message === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'empty_message']);
        exit;
    }
    if (text_contains_badword($message)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'message_forbidden']);
        exit;
    }

    // Basic length checks
    if (mb_strlen($name) > 15) $name = mb_substr($name, 0, 15);
    if (mb_strlen($message) > 100) $message = mb_substr($message, 0, 100);

    // sanitize: strip tags and collapse any weird control chars
    $name = strip_tags($name);
    $message = strip_tags($message);
    $message = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $message);

    // verify that the name is reserved by this token (preferred) or IP (fallback)
    $token = $_COOKIE['gb_token'] ?? '';
    $reserved_ok = false;
    if ($token && check_name_reserved_by_token($name, $token)) $reserved_ok = true;
    if (!$reserved_ok && check_name_reserved_by_ip($name, $ip)) $reserved_ok = true;
    if (!$reserved_ok) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'name_not_reserved']);
        exit;
    }

    $entry = add_message($name, $message, $ip);
    if (!$entry) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'write_failed']);
        exit;
    }
    // attach color for the posted entry based on current mapping
    $colors = read_colors();
    if (!empty($entry['ip_hash'])) {
        $c = find_color_for_iphash($colors, $entry['ip_hash']);
        $entry['color'] = $c !== '' ? $c : '';
    } else {
        $entry['color'] = '';
    }

    echo json_encode(['ok' => true, 'message' => $entry], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);

