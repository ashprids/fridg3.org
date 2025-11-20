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

// Get the client's IP address, honoring X-Forwarded-For when present.
function get_client_ip() {
    // If behind a proxy, X-Forwarded-For may contain a comma-separated list
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        if (count($parts)) return trim($parts[0]);
    }
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) return $_SERVER['HTTP_CLIENT_IP'];
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

if ($method === 'GET') {
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
    // Allow larger limits so admin/history can request the full stored set
    // (storage keeps up to 2000 entries). Sanitize invalid values.
    if ($limit <= 0) $limit = 100;
    if ($limit > 2000) $limit = 2000;
    $ip = get_client_ip();
    $reserved = '';
    $token = $_COOKIE['gb_token'] ?? '';
    if ($token) {
        $reserved = get_reserved_name_for_token($token);
    }
    if ($reserved === '' && $ip !== '') {
        $reserved = get_reserved_name_for_ip($ip);
    }
    // If caller is banned by name or IP, return a banned response
    if (is_banned_by_name_or_ip($reserved, $ip)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'banned' => true, 'message' => "You've been banned from using the guestbook. Contact me@fridg3.org if you believe this was in error."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $messages = read_messages($limit);
    // attach color per-message based on IP-hash mapping
    $colors = read_colors();
    foreach ($messages as &$m) {
        $m['color'] = '';
        if (!empty($m['ip_hash'])) {
            $col = find_color_for_iphash($colors, $m['ip_hash']);
            if ($col !== '') $m['color'] = $col;
        }
        // If the message was stored as an action, omit the timestamp in the
        // API response so clients that rely on server-rendering won't show it.
        if (!empty($m['is_action'])) {
            if (isset($m['time'])) unset($m['time']);
        }
    }
    unset($m);
    // report whether the caller already has a reserved name (so the client
    // does not need to persist the name locally)
    $out = ['ok' => true, 'messages' => $messages, 'reserved_name' => $reserved];

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
    $ip = get_client_ip() ?: 'unknown';
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
    $ip = get_client_ip();
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
    $ip = get_client_ip();
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
        // enforce allowed characters: letters and numbers only, allow a single underscore
        // pattern: one or more alnum, optionally a single underscore followed by one or more alnum
        if (!preg_match('/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?$/u', $newName)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_name_chars']);
            exit;
        }
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

            // If the requested name or caller IP is banned, refuse the reservation.
            if (is_banned_by_name_or_ip($newName, $ip)) {
                http_response_code(403);
                echo json_encode(['ok' => false, 'banned' => true, 'message' => "You've been banned from using the guestbook. Contact me@fridg3.org if you believe this was in error."], JSON_UNESCAPED_UNICODE);
                exit;
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

    // quick action: unreserve (clear caller's reservation)
    if (!empty($input['action']) && $input['action'] === 'unreserve') {
    $ip = get_client_ip();
        $token = $_COOKIE['gb_token'] ?? '';
        $map = read_name_reservations();
        $foundKey = null;
        // Prefer token-based lookup
        if ($token) {
            foreach ($map as $k => $v) {
                if (!is_array($v)) continue;
                if (isset($v['token']) && $v['token'] === $token) { $foundKey = $k; break; }
            }
        }
        // Fallback to IP match
        if ($foundKey === null && $ip !== '') {
            foreach ($map as $k => $v) {
                if (!is_array($v)) continue;
                if (isset($v['ip_hash']) && ip_matches($v['ip_hash'], $ip)) { $foundKey = $k; break; }
            }
        }
        if ($foundKey === null) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'no_reservation']);
            exit;
        }
        unset($map[$foundKey]);
        if (!write_name_reservations($map)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'write_failed']);
            exit;
        }
        // clear token cookie if present
        if ($token) {
            if (PHP_VERSION_ID >= 70300) {
                setcookie('gb_token', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
            } else {
                setcookie('gb_token', '', time() - 3600, '/', '', 0, true);
            }
        }
        echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // quick action: report (submit a user report)
    if (!empty($input['action']) && $input['action'] === 'report') {
    $ip = get_client_ip();
        $token = $_COOKIE['gb_token'] ?? '';
        // reporter must have a reserved name (token preferred, then IP)
        $reporter = '';
        if ($token) $reporter = get_reserved_name_for_token($token);
        if ($reporter === '' && $ip !== '') $reporter = get_reserved_name_for_ip($ip);
        if ($reporter === '') {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'not_reserved', 'message' => 'You must reserve a username before filing reports']);
            exit;
        }

        $target = trim($input['target'] ?? '');
        $reason = trim($input['reason'] ?? '');
        if ($target === '' || $reason === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_request']);
            exit;
        }

        // basic sanitization and length limits
        $target = strip_tags($target);
        if (mb_strlen($target) > 64) $target = mb_substr($target, 0, 64);
        $reason = strip_tags($reason);
        $reason = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $reason);
        if (mb_strlen($reason) > 1000) $reason = mb_substr($reason, 0, 1000);

        // optional: prevent reporting oneself
        if (mb_strtolower($target) === mb_strtolower($reporter)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'cannot_report_self']);
            exit;
        }

        // Only allow reporting usernames that are currently reserved
        $reservations = read_name_reservations();
        $tkey = mb_strtolower((string)$target);
        if (!isset($reservations[$tkey])) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'target_not_reserved', 'message' => 'The reported username is not reserved']);
            exit;
        }

        $entry = [
            'id' => (int) round(microtime(true) * 1000),
            'time' => gmdate('c'),
            'reporter' => $reporter,
            'reported' => $target,
            'reason' => $reason,
            'ip_hash' => $ip ? (string)$ip : '',
        ];

        if (!append_report($entry)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'write_failed']);
            exit;
        }

        echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
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

    // ban check: ensure neither the name nor the caller IP is banned
    if (is_banned_by_name_or_ip($name, $ip)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'banned' => true, 'message' => "You've been banned from using the guestbook. Contact me@fridg3.org if you believe this was in error."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $opts = [];
    if (!empty($input['announce'])) $opts['announce'] = true;
    if (!empty($input['cmd'])) $opts['cmd'] = true;
    // If the request originated from the admin guestbook UI, mark the post
    // so clients can render it specially. We use the Referer header here
    // (best-effort) because there is no separate admin auth in this repo.
    $ref = $_SERVER['HTTP_REFERER'] ?? '';
    if (is_string($ref) && strpos($ref, '/admin/guestbook') !== false) {
        $opts['admin'] = true;
    }
    $entry = add_message($name, $message, $ip, $opts);
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

