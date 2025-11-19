<?php
// Simple file-backed storage helper for guestbook
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}
$messagesFile = $dataDir . '/guestbook.json';
$colorsFile = $dataDir . '/colors.json';
$nameReservationsFile = $dataDir . '/name_reservations.json';
$badwordsFile = $dataDir . '/badwords.txt';
$reportsFile = '/admin/guestbook/reports/reports.json';

// Helper: check whether a stored ip value matches the current ip. Stored
// values may be raw IPs (new format) or legacy SHA1 hashes of the IP. We
// accept either for backward compatibility.
function ip_matches($stored, $ip) {
    if (!is_string($stored) || $stored === '') return false;
    if (!is_string($ip) || $ip === '') return false;
    if ($stored === $ip) return true;
    // legacy: stored value may be sha1(ip)
    if ($stored === sha1($ip)) return true;
    return false;
}

function read_messages($limit = 100) {
    global $messagesFile;
    if (!file_exists($messagesFile)) return [];
    $fp = fopen($messagesFile, 'r');
    if (!$fp) return [];
    flock($fp, LOCK_SH);
    $contents = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $arr = json_decode($contents, true);
    if (!is_array($arr)) return [];
    // assume stored newest-first already; return up to $limit
    return array_slice($arr, 0, $limit);
}

function read_reports($limit = 1000) {
    global $reportsFile;
    if (!file_exists($reportsFile)) return [];
    $fp = @fopen($reportsFile, 'r');
    if (!$fp) return [];
    flock($fp, LOCK_SH);
    $contents = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $arr = json_decode($contents, true);
    if (!is_array($arr)) return [];
    // newest-first
    return array_slice($arr, 0, $limit);
}

function append_report($entry) {
    global $reportsFile;
    $dir = dirname($reportsFile);
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0755, true)) return false;
    }
    if (!is_writable($dir)) return false;

    $arr = [];
    if (file_exists($reportsFile)) {
        $fp = @fopen($reportsFile, 'c+');
        if ($fp) {
            if (flock($fp, LOCK_EX)) {
                rewind($fp);
                $contents = stream_get_contents($fp);
                $tmp = json_decode($contents, true);
                if (is_array($tmp)) $arr = $tmp;
            }
            // release without closing - we'll rewrite via temp+rename
            if (isset($fp) && is_resource($fp)) { fflush($fp); flock($fp, LOCK_UN); fclose($fp); }
        }
    }

    array_unshift($arr, $entry);
    if (count($arr) > 2000) $arr = array_slice($arr, 0, 2000);

    $tmpFile = tempnam($dir, 'gbrp');
    if ($tmpFile === false) return false;
    $written = @file_put_contents($tmpFile, json_encode($arr, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($written === false) { @unlink($tmpFile); return false; }
    $renamed = @rename($tmpFile, $reportsFile);
    if (!$renamed) {
        $copied = @copy($tmpFile, $reportsFile);
        if ($copied) @unlink($tmpFile);
    }
    return file_exists($reportsFile);
}

function add_message($name, $message, $ip = null) {
    global $messagesFile;
    $name = trim(mb_substr($name ?? 'anon', 0, 15));
    $message = trim(mb_substr($message ?? '', 0, 100));
    // detect action (/me) messages: if message starts with '/me ' (case-insensitive)
    $is_action = false;
    if (is_string($message) && preg_match('/^\/me\s+/iu', $message)) {
        $is_action = true;
        // strip the leading '/me ' so stored message contains only the action text
        $message = preg_replace('/^\/me\s+/iu', '', $message);
    }
    $entry = [
        'id' => (int) round(microtime(true) * 1000),
        'time' => gmdate('c'),
        'name' => $name,
        'message' => $message,
        'is_action' => $is_action,
        // store raw IP going forward (field kept named ip_hash for legacy
        // compatibility with existing files)
        'ip_hash' => $ip ? (string)$ip : '',
    ];

    $dir = dirname($messagesFile);
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0755, true)) return false;
    }
    if (!is_writable($dir)) {
        // directory not writable
        return false;
    }

    // If file doesn't exist yet, create it directly (but check result)
    if (!file_exists($messagesFile)) {
        $first = [$entry];
        $w = @file_put_contents($messagesFile, json_encode($first, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        if ($w === false) return false;
        return $entry;
    }

    // Read current contents safely
    $fp = @fopen($messagesFile, 'c+'); // open for read/write
    if (!$fp) {
        return false;
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return false;
    }
    rewind($fp);
    $contents = stream_get_contents($fp);
    $arr = json_decode($contents, true);
    if (!is_array($arr)) $arr = [];
    array_unshift($arr, $entry); // newest-first
    if (count($arr) > 2000) $arr = array_slice($arr, 0, 2000);

    // write to a temp file in same directory and atomically rename
    $tmpFile = tempnam($dir, 'gbtmp');
    if ($tmpFile === false) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return false;
    }
    $written = @file_put_contents($tmpFile, json_encode($arr, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($written === false) {
        @unlink($tmpFile);
        flock($fp, LOCK_UN);
        fclose($fp);
        return false;
    }

    // attempt atomic replace
    $renamed = @rename($tmpFile, $messagesFile);
    if (!$renamed) {
        // some systems/filesystems may not allow rename across mounts; try copy+unlink as a fallback
        $copied = @copy($tmpFile, $messagesFile);
        if ($copied) {
            @unlink($tmpFile);
            $renamed = true;
        }
    }
    if (!$renamed) {
        // cleanup
        @unlink($tmpFile);
        flock($fp, LOCK_UN);
        fclose($fp);
        return false;
    }

    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $entry;
}

function ensure_rate_dir() {
    global $dataDir;
    $rl = $dataDir . '/ratelimit';
    if (!is_dir($rl)) @mkdir($rl, 0755, true);
    return $rl;
}

function read_colors() {
    global $colorsFile;
    if (!file_exists($colorsFile)) return [];
    $fp = @fopen($colorsFile, 'r');
    if (!$fp) return [];
    flock($fp, LOCK_SH);
    $contents = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $arr = json_decode($contents, true);
    if (!is_array($arr)) return [];
    return $arr;
}

function read_name_reservations() {
    global $nameReservationsFile;
    if (!file_exists($nameReservationsFile)) return [];
    $fp = @fopen($nameReservationsFile, 'r');
    if (!$fp) return [];
    flock($fp, LOCK_SH);
    $contents = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $arr = json_decode($contents, true);
    if (!is_array($arr)) return [];
    // clean expired entries
    $now = time();
    $out = [];
    foreach ($arr as $k => $v) {
        if (!is_array($v)) continue;
        if (isset($v['expires']) && (int)$v['expires'] > $now) $out[$k] = $v;
    }
    return $out;
}

function read_badwords() {
    global $badwordsFile;
    $out = [];
    if (!file_exists($badwordsFile)) return $out;
    $fp = @fopen($badwordsFile, 'r');
    if (!$fp) return $out;
    flock($fp, LOCK_SH);
    while (!feof($fp)) {
        $line = fgets($fp);
        if ($line === false) break;
        $line = preg_replace('/\R$/u', '', $line);
        $line = trim($line);
        if ($line === '') continue;
        // allow comments starting with #
        if (strpos($line, '#') === 0) continue;
        $out[] = $line;
    }
    flock($fp, LOCK_UN);
    fclose($fp);
    return $out;
}

/**
 * Check whether given text contains any prohibited word.
 * Matching is case-insensitive. For words composed only of "word" characters
 * (letters, digits, underscore) a whole-word match is used. For others a
 * substring check is used.
 */
function text_contains_badword($text) {
    if (!is_string($text) || $text === '') return false;
    $words = read_badwords();
    if (!is_array($words) || !count($words)) return false;
    foreach ($words as $w) {
        if (!is_string($w) || $w === '') continue;
        // whole-word pattern for simple words
        if (preg_match('/^\\w+$/u', $w)) {
            $pat = '/\\b' . preg_quote($w, '/') . '\\b/iu';
            if (preg_match($pat, $text)) return true;
        } else {
            if (mb_stripos($text, $w) !== false) return true;
        }
    }
    return false;
}

function write_name_reservations($map) {
    global $nameReservationsFile;
    $dir = dirname($nameReservationsFile);
    if (!is_dir($dir)) { if (!@mkdir($dir, 0755, true)) return false; }
    $tmpFile = tempnam($dir, 'gbnr');
    if ($tmpFile === false) return false;
    $w = @file_put_contents($tmpFile, json_encode($map, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($w === false) { @unlink($tmpFile); return false; }
    $renamed = @rename($tmpFile, $nameReservationsFile);
    if (!$renamed) { $copied = @copy($tmpFile, $nameReservationsFile); if ($copied) @unlink($tmpFile); }
    return file_exists($nameReservationsFile);
}

function set_name_reservation($name, $ip, $days = 30, $token = null) {
    global $nameReservationsFile;
    $key = mb_strtolower((string) $name);
    $ip_hash = $ip ? (string)$ip : '';
    $now = time();
    $expires = $now + max(1, (int)$days) * 24 * 3600;

    $map = read_name_reservations();
    // check existing
    if (isset($map[$key])) {
        $rec = $map[$key];
        if (isset($rec['expires']) && (int)$rec['expires'] > $now) {
            // If a token was provided and matches the existing reservation,
            // allow renewal. Otherwise allow renewal if the IP matches.
            if ($token !== null && isset($rec['token']) && $rec['token'] === $token) {
                // same token owner -> allowed to renew
            } elseif (isset($rec['ip_hash']) && ip_matches($rec['ip_hash'], $ip)) {
                // same IP -> allowed to renew
            } else {
                // reserved by someone else
                return false;
            }
        }
    }
    $map[$key] = ['ip_hash' => $ip_hash, 'expires' => $expires, 'name' => $name, 'token' => ($token !== null ? (string)$token : '')];
    return write_name_reservations($map) ? $expires : false;
}

// Find a reservation record by opaque token value. Returns the record array
// or null if not found or expired.
function find_reservation_by_token($token) {
    if (!is_string($token) || $token === '') return null;
    $map = read_name_reservations();
    $now = time();
    foreach ($map as $k => $v) {
        if (!is_array($v)) continue;
        if (isset($v['token']) && is_string($v['token']) && $v['token'] === $token) {
            if (isset($v['expires']) && (int)$v['expires'] > $now) return $v;
        }
    }
    return null;
}

// Check whether a given name is reserved by a specific token.
function check_name_reserved_by_token($name, $token) {
    if (!is_string($token) || $token === '') return false;
    $map = read_name_reservations();
    $key = mb_strtolower((string)$name);
    if (!isset($map[$key])) return false;
    $rec = $map[$key];
    if (!isset($rec['token']) || $rec['token'] !== $token) return false;
    if (!isset($rec['expires']) || (int)$rec['expires'] <= time()) return false;
    return true;
}

// Return reserved name for a token, or empty string
function get_reserved_name_for_token($token) {
    $rec = find_reservation_by_token($token);
    if (!$rec) return '';
    return isset($rec['name']) ? $rec['name'] : '';
}

function check_name_reserved_by_ip($name, $ip) {
    $map = read_name_reservations();
    $key = mb_strtolower((string)$name);
    if (!isset($map[$key])) return false;
    $rec = $map[$key];
    if (!isset($rec['ip_hash']) || !ip_matches($rec['ip_hash'], $ip)) return false;
    if (!isset($rec['expires']) || (int)$rec['expires'] <= time()) return false;
    return true;
}

function get_reserved_name_for_ip($ip) {
    // returns the reserved name (original-cased) for the given IP, or empty string
    $map = read_name_reservations();
    if (!is_string($ip) || $ip === '') return '';
    foreach ($map as $k => $v) {
        if (!is_array($v)) continue;
        if (isset($v['ip_hash']) && ip_matches($v['ip_hash'], $ip) && isset($v['expires']) && (int)$v['expires'] > time()) {
            return isset($v['name']) ? $v['name'] : $k;
        }
    }
    return '';
}


function set_color_by_ip($ip, $idx) {
    global $colorsFile;
    $key = (string)$ip;
    if ($key === '') return false;
    $idx = (int)$idx;
    if ($idx < 1) $idx = 1;
    if ($idx > 8) $idx = 8;

    $dir = dirname($colorsFile);
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0755, true)) return false;
    }

    // read current mapping
    $map = [];
    if (file_exists($colorsFile)) {
        $fp = @fopen($colorsFile, 'c+');
        if ($fp) {
            if (flock($fp, LOCK_EX)) {
                rewind($fp);
                $contents = stream_get_contents($fp);
                $tmp = json_decode($contents, true);
                if (is_array($tmp)) $map = $tmp;
            }
        }
    }

    $map[$key] = $idx;

    // write atomically
    $tmpFile = tempnam($dir, 'gbcol');
    if ($tmpFile === false) return false;
    $w = @file_put_contents($tmpFile, json_encode($map, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($w === false) { @unlink($tmpFile); return false; }
    $renamed = @rename($tmpFile, $colorsFile);
    if (!$renamed) {
        $copied = @copy($tmpFile, $colorsFile);
        if ($copied) @unlink($tmpFile);
    }

    return file_exists($colorsFile);
}

function check_rate_limit($ip, $perMinute = 5000, $perDay = 20000) {
    $rl = ensure_rate_dir();
    $safe = preg_replace('/[^A-Za-z0-9_\-\.]/', '_', $ip);
    $file = "$rl/$safe.json";
    $data = ['minute_ts' => 0, 'minute_count' => 0, 'day_ts' => 0, 'day_count' => 0];

    $fp = fopen($file, 'c+');
    if (!$fp) return true; // allow if we can't create file
    flock($fp, LOCK_EX);
    rewind($fp);
    $contents = stream_get_contents($fp);
    if ($contents) {
        $tmp = json_decode($contents, true);
        if (is_array($tmp)) $data = $tmp;
    }

    $now = time();
    // minute window
    if ($now - ($data['minute_ts'] ?? 0) >= 60) {
        $data['minute_ts'] = $now;
        $data['minute_count'] = 0;
    }
    // day window (UTC midnight)
    $todayStart = strtotime(gmdate('Y-m-d 00:00:00'));
    if (($data['day_ts'] ?? 0) < $todayStart) {
        $data['day_ts'] = $todayStart;
        $data['day_count'] = 0;
    }

    $allowed = true;
    if (($data['minute_count'] ?? 0) + 1 > $perMinute) $allowed = false;
    if (($data['day_count'] ?? 0) + 1 > $perDay) $allowed = false;

    if ($allowed) {
        $data['minute_count'] = ($data['minute_count'] ?? 0) + 1;
        $data['day_count'] = ($data['day_count'] ?? 0) + 1;
        // truncate and write back
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data));
    }

    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $allowed;
}

// debug logging removed

