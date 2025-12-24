<?php
// Admin credentials config loaded from /admin/.env.
// Expected keys:
//   ADMIN_PASSWORD_FRIDGE="..."
//   ADMIN_PASSWORD_FREEZER="..."

$envPath = __DIR__ . '/.env';
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $trim = trim($line);
        if ($trim === '' || strpos($trim, '#') === 0) continue;
        $parts = explode('=', $trim, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $val = trim($parts[1]);
            // strip wrapping quotes if present
            $val = preg_replace('/^"(.*)"$/', '$1', $val);
            $val = preg_replace("/'(.*)'/", '$1', $val);
            putenv($key . '=' . $val);
        }
    }
}

// Build user map strictly from env (no hardcoded defaults)
$ADMIN_USERS = [];
$fridgePw = getenv('ADMIN_PASSWORD_FRIDGE') ?: '';
$freezerPw = getenv('ADMIN_PASSWORD_FREEZER') ?: '';
if ($fridgePw !== '') {
    $ADMIN_USERS['fridge'] = $fridgePw;
}
if ($freezerPw !== '') {
    $ADMIN_USERS['freezer'] = $freezerPw;
}

// Allowed usernames are those with non-empty configured passwords
$ALLOWED_USERNAMES = array_keys($ADMIN_USERS);
