<?php

const EMAIL_CONTACT_COOLDOWN_SECONDS = 604800;
const EMAIL_CONTACT_FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/me@fridg3.org';

function email_contact_extract_client_ip(): string {
    $headerCandidates = [
        'HTTP_CF_CONNECTING_IP',
        'HTTP_TRUE_CLIENT_IP',
        'HTTP_X_REAL_IP',
        'HTTP_X_FORWARDED_FOR',
        'REMOTE_ADDR'
    ];

    foreach ($headerCandidates as $header) {
        if (!isset($_SERVER[$header]) || $_SERVER[$header] === '') {
            continue;
        }

        $parts = explode(',', (string)$_SERVER[$header]);
        foreach ($parts as $part) {
            $candidate = trim($part);
            if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_IP)) {
                return $candidate;
            }
        }
    }

    return '0.0.0.0';
}

function email_contact_get_visitor_context(): array {
    $ip = email_contact_extract_client_ip();
    $userAgent = trim((string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
    $acceptLanguage = trim((string)($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''));

    if ($userAgent !== '') {
        $userAgent = function_exists('mb_substr') ? mb_substr($userAgent, 0, 500) : substr($userAgent, 0, 500);
    }
    if ($acceptLanguage !== '') {
        $acceptLanguage = function_exists('mb_substr') ? mb_substr($acceptLanguage, 0, 200) : substr($acceptLanguage, 0, 200);
    }

    return [
        'ip' => $ip,
        'user_agent' => $userAgent,
        'accept_language' => $acceptLanguage,
        'fingerprint' => hash('sha256', $ip . '|' . $userAgent . '|' . $acceptLanguage)
    ];
}

function email_contact_data_dir(): string {
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'etc';
}

function email_contact_submissions_path(): string {
    return email_contact_data_dir() . DIRECTORY_SEPARATOR . 'email-submissions.json';
}

function email_contact_blacklist_path(): string {
    return email_contact_data_dir() . DIRECTORY_SEPARATOR . 'email-blacklist.json';
}

function email_contact_ensure_data_dir(): bool {
    $dir = email_contact_data_dir();
    if (is_dir($dir)) {
        return true;
    }

    return @mkdir($dir, 0775, true) || is_dir($dir);
}

function email_contact_load_json(string $path, array $default = []): array {
    if (!is_file($path)) {
        return $default;
    }

    $decoded = json_decode((string)@file_get_contents($path), true);
    return is_array($decoded) ? $decoded : $default;
}

function email_contact_mutate_json_file(string $path, callable $mutator): bool {
    if (!email_contact_ensure_data_dir()) {
        return false;
    }

    $handle = @fopen($path, 'c+');
    if ($handle === false) {
        return false;
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        return false;
    }

    $raw = stream_get_contents($handle);
    $state = [];
    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $state = $decoded;
        }
    }

    $nextState = $mutator($state);
    if (!is_array($nextState)) {
        $nextState = $state;
    }

    rewind($handle);
    ftruncate($handle, 0);
    $encoded = json_encode($nextState, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    $ok = $encoded !== false && fwrite($handle, $encoded) !== false;
    if ($ok) {
        fflush($handle);
    }

    flock($handle, LOCK_UN);
    fclose($handle);
    return $ok;
}

function email_contact_is_blacklisted_ip(array $blacklistState, string $ip): bool {
    if ($ip === '') {
        return false;
    }

    return isset($blacklistState['ips']) && is_array($blacklistState['ips']) && isset($blacklistState['ips'][$ip]);
}

function email_contact_get_access_state(array $visitor, ?array $submissionsState = null, ?array $blacklistState = null): array {
    $submissionsState = is_array($submissionsState) ? $submissionsState : email_contact_load_json(email_contact_submissions_path(), []);
    $blacklistState = is_array($blacklistState) ? $blacklistState : email_contact_load_json(email_contact_blacklist_path(), []);

    $fingerprint = (string)($visitor['fingerprint'] ?? '');
    $ip = (string)($visitor['ip'] ?? '');
    $now = time();

    $visitorRecord = [];
    if (isset($submissionsState['visitors'][$fingerprint]) && is_array($submissionsState['visitors'][$fingerprint])) {
        $visitorRecord = $submissionsState['visitors'][$fingerprint];
    }

    $ipRecord = [];
    if (isset($submissionsState['ips'][$ip]) && is_array($submissionsState['ips'][$ip])) {
        $ipRecord = $submissionsState['ips'][$ip];
    }

    $cooldownUntil = max(
        (int)($visitorRecord['cooldown_until'] ?? 0),
        (int)($ipRecord['cooldown_until'] ?? 0)
    );
    $cooldownRemaining = max(0, $cooldownUntil - $now);

    return [
        'is_blacklisted' => email_contact_is_blacklisted_ip($blacklistState, $ip),
        'is_on_cooldown' => $cooldownRemaining > 0,
        'cooldown_remaining' => $cooldownRemaining,
        'cooldown_until' => $cooldownUntil,
        'cooldown_attempts' => (int)($ipRecord['cooldown_attempts'] ?? 0),
        'last_submission_at' => max(
            (int)($visitorRecord['last_submission_at'] ?? 0),
            (int)($ipRecord['last_submission_at'] ?? 0)
        )
    ];
}

function email_contact_format_countdown(int $seconds): string {
    $seconds = max(0, $seconds);
    $days = intdiv($seconds, 86400);
    $seconds %= 86400;
    $hours = intdiv($seconds, 3600);
    $seconds %= 3600;
    $minutes = intdiv($seconds, 60);
    $seconds %= 60;

    return sprintf('%02d:%02d:%02d:%02d', $days, $hours, $minutes, $seconds);
}

