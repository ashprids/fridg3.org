<?php

$sessionBootstrapDir = __DIR__;
while (!file_exists($sessionBootstrapDir . "/lib/session.php") && dirname($sessionBootstrapDir) !== $sessionBootstrapDir) {
    $sessionBootstrapDir = dirname($sessionBootstrapDir);
}
require_once $sessionBootstrapDir . "/lib/session.php";
fridg3_start_session();

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'account' . DIRECTORY_SEPARATOR . 'admin' . DIRECTORY_SEPARATOR . 'helpers.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'lib' . DIRECTORY_SEPARATOR . 'feed.php';

account_admin_require_admin();

if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function settings_banned_ips_verify_admin_password(string $password, array $accountsData): bool {
    $currentUsername = isset($_SESSION['user']['username']) ? (string)$_SESSION['user']['username'] : '';
    if ($currentUsername === '') {
        return false;
    }

    foreach ($accountsData['accounts'] as $account) {
        if (!isset($account['username']) || (string)$account['username'] !== $currentUsername) {
            continue;
        }
        if (empty($account['password'])) {
            return $password === '';
        }

        $storedPassword = (string)$account['password'];
        if (password_get_info($storedPassword)['algo'] !== null) {
            return password_verify($password, $storedPassword);
        }

        return hash_equals($storedPassword, $password);
    }

    return false;
}

function settings_banned_ips_rows(array $bannedIps): array {
    $rows = [];
    foreach ($bannedIps as $key => $entry) {
        $ip = '';
        if (is_string($key) && filter_var($key, FILTER_VALIDATE_IP)) {
            $ip = $key;
        } elseif (is_string($entry) && filter_var($entry, FILTER_VALIDATE_IP)) {
            $ip = $entry;
        } elseif (is_array($entry) && isset($entry['ip']) && filter_var((string)$entry['ip'], FILTER_VALIDATE_IP)) {
            $ip = (string)$entry['ip'];
        }

        if ($ip === '') {
            continue;
        }

        $rows[$ip] = is_array($entry) ? $entry : [];
    }

    ksort($rows, SORT_NATURAL);
    return $rows;
}

function settings_banned_ips_entry_usernames(array $entry): array {
    $usernames = [];
    foreach (['usernames', 'usedUsernames', 'names'] as $key) {
        if (!isset($entry[$key]) || !is_array($entry[$key])) {
            continue;
        }
        foreach ($entry[$key] as $username) {
            $name = trim((string)$username);
            if ($name !== '') {
                $usernames[$name] = true;
            }
        }
    }

    if (isset($entry['username'])) {
        $name = trim((string)$entry['username']);
        if ($name !== '') {
            $usernames[$name] = true;
        }
    }

    return array_keys($usernames);
}

function settings_banned_ips_remove_ip(array $bannedIps, string $targetIp): array {
    $updated = [];
    $wasList = array_keys($bannedIps) === range(0, count($bannedIps) - 1);
    foreach ($bannedIps as $key => $entry) {
        $entryIp = '';
        if (is_string($key) && filter_var($key, FILTER_VALIDATE_IP)) {
            $entryIp = $key;
        } elseif (is_string($entry) && filter_var($entry, FILTER_VALIDATE_IP)) {
            $entryIp = $entry;
        } elseif (is_array($entry) && isset($entry['ip']) && filter_var((string)$entry['ip'], FILTER_VALIDATE_IP)) {
            $entryIp = (string)$entry['ip'];
        }

        if ($entryIp === $targetIp) {
            continue;
        }

        $updated[$key] = $entry;
    }

    return $wasList ? array_values($updated) : $updated;
}

$title = 'manage guests';
$description = 'manage guest feed replies and IP moderation.';
$noticeHtml = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $submittedToken = (string)($_POST['csrf_token'] ?? '');
    $action = (string)($_POST['action'] ?? '');
    $ip = trim((string)($_POST['ip'] ?? ''));

    if (!hash_equals((string)$_SESSION['csrf_token'], $submittedToken)) {
        $noticeHtml = '<div id="error">invalid request. please try again.</div><br>';
    } elseif (!filter_var($ip, FILTER_VALIDATE_IP)) {
        $noticeHtml = '<div id="error">invalid IP address.</div><br>';
    } elseif ($action === 'purge_replies') {
        $accountsData = account_admin_load_accounts();
        if (!settings_banned_ips_verify_admin_password((string)($_POST['admin_password'] ?? ''), $accountsData)) {
            $noticeHtml = '<div id="error">admin password did not match. purge cancelled.</div><br>';
        } else {
            $result = fridg3_feed_purge_guest_replies_by_ip($ip);
            $deletedLabel = (int)$result['deleted'] === 1 ? 'guest feed reply' : 'guest feed replies';
            $failedLabel = (int)$result['failed'] === 1 ? 'reply file' : 'reply files';
            if ($result['failed'] > 0) {
                $noticeHtml = '<div id="error">deleted ' . (int)$result['deleted'] . ' ' . $deletedLabel
                    . ', but ' . (int)$result['failed'] . ' ' . $failedLabel
                    . ' failed. check file permissions.</div><br>';
            } elseif ($result['deleted'] === 0) {
                $noticeHtml = '<div id="result">no guest feed replies found for this IP.</div><br>';
            } else {
                $noticeHtml = '<div id="result">deleted ' . (int)$result['deleted'] . ' ' . $deletedLabel
                    . ' from ' . htmlspecialchars($ip, ENT_QUOTES, 'UTF-8') . '.</div><br>';
            }
        }
    } elseif ($action === 'unban') {
        $bannedIps = fridg3_feed_load_banned_ips();
        $updated = settings_banned_ips_remove_ip($bannedIps, $ip);
        if ($updated === $bannedIps) {
            $noticeHtml = '<div id="result">that IP is not currently banned.</div><br>';
        } elseif (!fridg3_feed_write_banned_ips($updated)) {
            $noticeHtml = '<div id="error">failed to unban IP. check file permissions.</div><br>';
        } else {
            $noticeHtml = '<div id="result">unbanned ' . htmlspecialchars($ip, ENT_QUOTES, 'UTF-8') . '.</div><br>';
        }
    }
}

$bannedIps = fridg3_feed_load_banned_ips();
$rows = settings_banned_ips_rows($bannedIps);
$guestUsernamesByIp = fridg3_feed_collect_guest_usernames_by_ip();
$guestRepliesByIp = fridg3_feed_collect_guest_replies_by_ip();
$allIps = array_fill_keys(array_merge(array_keys($rows), array_keys($guestRepliesByIp)), true);
$allIps = array_keys($allIps);
sort($allIps, SORT_NATURAL);
$csrf = htmlspecialchars((string)$_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8');

$content = '<h1>manage guests</h1>'
    . '<h2>guest feed reply moderation</h2>'
    . $noticeHtml
    . '<p style="color: var(--subtle);">guest replies are grouped by IP. purging replies deletes guest feed replies from an IP. it does not ban or unban the IP.</p>'
    . '<br>';

if (empty($allIps)) {
    $content .= '<p>no guest replies or banned IP addresses.</p>';
} else {
    $content .= '<div class="account-admin-grid">';
    foreach ($allIps as $ip) {
        $entry = $rows[$ip] ?? [];
        $isBanned = array_key_exists($ip, $rows);
        $guestReplies = $guestRepliesByIp[$ip] ?? [];
        $usernames = [];
        foreach (settings_banned_ips_entry_usernames($entry) as $name) {
            $usernames[$name] = true;
        }
        foreach (($guestUsernamesByIp[$ip] ?? []) as $name) {
            $usernames[(string)$name] = true;
        }
        $usernameList = array_keys($usernames);
        sort($usernameList, SORT_NATURAL | SORT_FLAG_CASE);
        $usernameText = empty($usernameList)
            ? 'no usernames recorded'
            : implode(', ', array_map(static function ($name) {
                return htmlspecialchars((string)$name, ENT_QUOTES, 'UTF-8');
            }, $usernameList));

        $safeIp = htmlspecialchars($ip, ENT_QUOTES, 'UTF-8');
        $replyCount = count($guestReplies);
        $replyLabel = $replyCount === 1 ? '1 guest reply' : $replyCount . ' guest replies';
        $content .= '<div class="account-admin-card">'
            . '<strong>' . $safeIp . '</strong>'
            . '<span>' . ($isBanned ? 'banned' : 'not banned') . ' &middot; ' . htmlspecialchars($replyLabel, ENT_QUOTES, 'UTF-8') . '</span>'
            . '<span>usernames: ' . $usernameText . '</span>'
            . '<span class="account-admin-meta">'
            . '<form method="post" action="/settings/guests/" data-no-spa="1" data-site-confirm="1" data-admin-password-confirm="1" data-confirm-title="purge replies from this IP?" data-confirm-detail="this deletes guest feed replies from this IP. it does not ban or unban the IP." data-confirm-text="purge replies" data-cancel-text="cancel" data-password-title="confirm reply purge" data-password-detail="enter your admin password to purge guest feed replies from this IP." style="display:inline-block; margin-right: 8px;">'
            . '<input type="hidden" name="csrf_token" value="' . $csrf . '">'
            . '<input type="hidden" name="action" value="purge_replies">'
            . '<input type="hidden" name="ip" value="' . $safeIp . '">'
            . '<button class="danger-button" type="submit">purge replies</button>'
            . '</form>';
        if ($isBanned) {
            $content .= '<form method="post" action="/settings/guests/" data-no-spa="1" data-site-confirm="1" data-confirm-title="unban IP?" data-confirm-detail="this allows new guest replies from this IP again." data-confirm-text="unban" data-cancel-text="cancel" style="display:inline-block;">'
                . '<input type="hidden" name="csrf_token" value="' . $csrf . '">'
                . '<input type="hidden" name="action" value="unban">'
                . '<input type="hidden" name="ip" value="' . $safeIp . '">'
                . '<button id="form-button" type="submit">unban</button>'
                . '</form>';
        }
        $content .= '</span>';

        if (empty($guestReplies)) {
            $content .= '<span style="color: var(--subtle);">no guest replies from this IP.</span>';
        } else {
            $content .= '<div class="feed-replies-list guest-management-replies" style="margin-top: 12px;">';
            foreach ($guestReplies as $reply) {
                $replyUser = htmlspecialchars((string)($reply['username'] ?? 'Anonymous'), ENT_QUOTES, 'UTF-8');
                $replyDateRaw = (string)($reply['date'] ?? '');
                $replyDate = htmlspecialchars($replyDateRaw !== '' ? fridg3_feed_humanize_datetime($replyDateRaw) : 'unknown date', ENT_QUOTES, 'UTF-8');
                $postId = (string)($reply['postId'] ?? '');
                $postUrl = '/feed/posts/' . rawurlencode($postId);
                $replyBody = htmlspecialchars((string)($reply['body'] ?? ''), ENT_QUOTES, 'UTF-8');
                $content .= '<div class="feed-reply">'
                    . '<div class="feed-reply-header">'
                    . '<span class="feed-reply-username"><em>' . $replyUser . '</em></span>'
                    . '<span class="feed-reply-date">' . $replyDate . ' &middot; <a href="' . $postUrl . '">view</a></span>'
                    . '</div>'
                    . '<div class="post-content feed-reply-body">' . $replyBody . '</div>'
                    . '</div>';
            }
            $content .= '</div>';
        }

        $content .= '</div>';
    }
    $content .= '</div>';
}

account_admin_render_page($title, $description, $content);
?>
