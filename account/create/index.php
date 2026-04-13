<?php

$sessionBootstrapDir = __DIR__;
while (!file_exists($sessionBootstrapDir . "/lib/session.php") && dirname($sessionBootstrapDir) !== $sessionBootstrapDir) {
    $sessionBootstrapDir = dirname($sessionBootstrapDir);
}
require_once $sessionBootstrapDir . "/lib/session.php";
fridg3_start_session();

// Restrict access to logged-in admins only
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['username'])) {
    header('Location: /account/login');
    exit;
}

// Refresh admin flag from accounts.json so revocations take effect without re-login
$currentUsername = $_SESSION['user']['username'];
$accountsPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . 'accounts.json';
if (is_file($accountsPath)) {
    $accountsData = json_decode(@file_get_contents($accountsPath), true);
    if (isset($accountsData['accounts']) && is_array($accountsData['accounts'])) {
        foreach ($accountsData['accounts'] as $account) {
            if (isset($account['username']) && $account['username'] === $currentUsername) {
                $_SESSION['user']['isAdmin'] = (bool)($account['isAdmin'] ?? false);
                break;
            }
        }
    }
}

$isAdmin = !empty($_SESSION['user']['isAdmin']);
if (!$isAdmin) {
    http_response_code(403);
    echo '403 forbidden: admin access required';
    exit;
}

// Form/result state
$resultVisible = false;
$errorMessage = '';
$resultUsername = '';
$resultPassword = '';
$formUsername = '';
$formName = '';
$formDiscordUserId = '';
$formIsAdmin = false;
$formAllowFeed = false;
$formAllowJournal = false;
$formAllowComments = false;

function generate_random_password(int $length = 15): string {
    $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    $out = '';
    $max = strlen($chars) - 1;
    for ($i = 0; $i < $length; $i++) {
        $out .= $chars[random_int(0, $max)];
    }
    return $out;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $formUsername = trim($_POST['username'] ?? '');
    $formName = trim($_POST['name'] ?? '');
    $formDiscordUserId = trim($_POST['discordUserId'] ?? '');
    $formIsAdmin = isset($_POST['isAdmin']);
    $formAllowFeed = isset($_POST['allowFeed']);
    $formAllowJournal = isset($_POST['allowJournal']);
    $formAllowComments = isset($_POST['allowComments']);

    if ($formUsername === '' || $formName === '') {
        $errorMessage = 'username and name are required.';
    } elseif (!preg_match('/^[a-z0-9_-]{1,50}$/i', $formUsername)) {
        $errorMessage = 'username must be 1-50 characters (letters, numbers, underscores, hyphens).';
    } elseif (strlen($formName) > 100) {
        $errorMessage = 'name is too long (max 100 characters).';
    } elseif ($formDiscordUserId !== '' && !preg_match('/^\d{17,20}$/', $formDiscordUserId)) {
        $errorMessage = 'discord user id must be 17-20 digits.';
    } else {
        $accountsData = json_decode(@file_get_contents($accountsPath), true);
        if (!is_array($accountsData)) {
            $accountsData = ['accounts' => []];
        }
        if (!isset($accountsData['accounts']) || !is_array($accountsData['accounts'])) {
            $accountsData['accounts'] = [];
        }

        foreach ($accountsData['accounts'] as $account) {
            if (isset($account['username']) && strcasecmp((string)$account['username'], $formUsername) === 0) {
                $errorMessage = 'username already exists.';
                break;
            }
        }

        if ($errorMessage === '') {
            $plainPassword = generate_random_password(15);
            $passwordHash = password_hash($plainPassword, PASSWORD_BCRYPT);

            $allowedPages = [];
            if ($formAllowFeed) {
                $allowedPages[] = 'feed';
            }
            if ($formAllowJournal) {
                $allowedPages[] = 'journal';
            }
            if ($formAllowComments) {
                $allowedPages[] = 'comments';
            }

            $newAccount = [
                'username' => $formUsername,
                'name' => $formName,
                'password' => $passwordHash,
                'isAdmin' => $formIsAdmin,
                'mustResetPassword' => true,
                'allowedPages' => $allowedPages,
            ];
            if ($formDiscordUserId !== '') {
                $newAccount['discordUserId'] = $formDiscordUserId;
            }

            $accountsData['accounts'][] = $newAccount;

            $encoded = json_encode($accountsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            if ($encoded === false || @file_put_contents($accountsPath, $encoded, LOCK_EX) === false) {
                $errorMessage = 'failed to save account. please try again.';
            } else {
                if ($formDiscordUserId !== '') {
                    $inviteBotError = null;
                    $inviteResponseRaw = null;

                    if (function_exists('curl_init')) {
                        $ch = curl_init('http://127.0.0.1:8765/send-account-invite');
                        curl_setopt($ch, CURLOPT_POST, true);
                        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
                            'discord_user_id' => $formDiscordUserId,
                            'site_username' => $formUsername,
                            'site_password' => $plainPassword,
                        ], JSON_UNESCAPED_SLASHES));
                        $inviteResponseRaw = curl_exec($ch);
                        if ($inviteResponseRaw === false) {
                            $inviteBotError = curl_error($ch);
                        }
                        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                        curl_close($ch);
                        if ($inviteBotError === null && $httpCode >= 400) {
                            $inviteBotError = 'bot returned http ' . $httpCode;
                        }
                    } else {
                        $context = stream_context_create([
                            'http' => [
                                'method' => 'POST',
                                'header' => "Content-Type: application/json\r\n",
                                'content' => json_encode([
                                    'discord_user_id' => $formDiscordUserId,
                                    'site_username' => $formUsername,
                                    'site_password' => $plainPassword,
                                ], JSON_UNESCAPED_SLASHES),
                                'timeout' => 10,
                            ],
                        ]);
                        $inviteResponseRaw = @file_get_contents('http://127.0.0.1:8765/send-account-invite', false, $context);
                        if ($inviteResponseRaw === false) {
                            $inviteBotError = 'could not contact discord bot';
                        }
                    }

                    if ($inviteBotError !== null) {
                        $errorMessage = 'account created, but the discord invite dm failed: ' . $inviteBotError;
                    } else {
                        $inviteResponse = json_decode((string)$inviteResponseRaw, true);
                        if (!is_array($inviteResponse) || empty($inviteResponse['ok'])) {
                            $errorMessage = 'account created, but the discord invite dm failed.';
                        }
                    }
                }

                $resultVisible = true;
                $resultUsername = $formUsername;
                $resultPassword = $plainPassword;
                $formUsername = '';
                $formName = '';
                $formDiscordUserId = '';
                $formIsAdmin = false;
                $formAllowFeed = false;
                $formAllowJournal = false;
                $formAllowComments = false;
            }
        }
    }
}

$title = 'create account';
$description = 'generate a new fridg3.org account.';


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

$render_helper_path = find_template_file('lib/render.php');
if ($render_helper_path) {
    require_once $render_helper_path;
}

$template_name = function_exists('get_preferred_template_name')
    ? get_preferred_template_name(__DIR__)
    : 'template.html';
$template_path = find_template_file($template_name);
if (!$template_path && $template_name !== 'template.html') {
    $template_path = find_template_file('template.html');
}
if (!$template_path) {
    die('page template not found. report this issue to me@fridg3.org.');
}

$template = file_get_contents($template_path);

$content_path = find_template_file('content.html');
if (!$content_path) {
    die('content.html not found. report this issue to me@fridg3.org.');
}

$content = file_get_contents($content_path);
$content = str_replace([
    '{error_style}',
    '{error_message}',
    '{result_style}',
    '{result_username}',
    '{result_password}',
    '{form_username}',
    '{form_name}',
    '{form_discord_user_id}',
    '{is_admin_checked}',
    '{allow_feed_checked}',
    '{allow_journal_checked}',
    '{allow_comments_checked}',
], [
    $errorMessage === '' ? 'display:none;' : '',
    htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8'),
    $resultVisible ? '' : 'display:none;',
    htmlspecialchars($resultUsername, ENT_QUOTES, 'UTF-8'),
    htmlspecialchars($resultPassword, ENT_QUOTES, 'UTF-8'),
    htmlspecialchars($formUsername, ENT_QUOTES, 'UTF-8'),
    htmlspecialchars($formName, ENT_QUOTES, 'UTF-8'),
    htmlspecialchars($formDiscordUserId, ENT_QUOTES, 'UTF-8'),
    $formIsAdmin ? 'checked' : '',
    $formAllowFeed ? 'checked' : '',
    $formAllowJournal ? 'checked' : '',
    $formAllowComments ? 'checked' : '',
], $content);
$html = str_replace('{content}', $content, $template);
$html = str_replace('{title}', $title, $html);
$html = str_replace('{description}', $description, $html);

// Inject user greeting and swap account button when logged in
$user_greeting = '';
if (isset($_SESSION['user']) && isset($_SESSION['user']['name'])) {
    $user_name = htmlspecialchars($_SESSION['user']['name'], ENT_QUOTES, 'UTF-8');
    $user_greeting = '<div id="user-greeting">Hello, ' . $user_name . '!</div>';
    // Swap Account button to Logout in the template footer
    $accountBtn = '<a href="/account"><div id="footer-button" data-tooltip="access your fridg3.org account"><i class="fa-solid fa-user"></i></div></a>';
    $logoutBtn = '<a href="/account/logout"><div id="footer-button" data-tooltip="log out"><i class="fa-solid fa-right-from-bracket"></i></div></a>';
    $html = str_replace($accountBtn, $logoutBtn, $html);
}
$html = str_replace('{user_greeting}', $user_greeting, $html);
echo $html;
?>
