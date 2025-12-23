<?php

// Username mapping for display
$username_map = [
    'fridge' => '@fridgestuff',
    'freezer' => '@yaztastrophe'
];

$id = basename($_GET['id']);
$file = __DIR__ . "/posts/$id.txt";

if (!file_exists($file)) {
    http_response_code(404);
    $error = file_get_contents(__DIR__ . "/404.html");
    echo $error;
}

$lines = file($file, FILE_IGNORE_NEW_LINES);
$user = $lines[0] ?? "fridge";
$displayUsername = htmlspecialchars($username_map[$user] ?? '@' . $user, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$userSafe = htmlspecialchars($user, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$date = $lines[1] ?? "";
$body = array_slice($lines, 2);

// remove the [IMAGE:...] tag and extract the image name
$has_image = null;
foreach ($body as $i => $line) {
    if (str_starts_with($line, "[IMAGE:")) {
        $has_image = trim(str_replace(["[IMAGE:", "]"], "", $line));
        unset($body[$i]);
    }
}

$body = array_values($body); // reindex the array
$text = implode("<br>", $body);

// append the image *inside* the paragraph
if ($has_image) {
    $text .= "<br><br><a href='images/$has_image'><img id='microblog-image' src='images/$has_image' style='max-width: 100%; border-radius: 8px;'></a>";
}

$preview = htmlspecialchars(substr(strip_tags($text), 0, 160)) . (strlen($text) > 160 ? "..." : "");
$url = "https://fridg3.org/microblog/post.php?id=$id";
$title = "$user | microblog post from $date";
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title><?php echo $title; ?></title>
    <meta name="description" content="<?php echo $preview; ?>">
    <link rel="icon" type="image/x-icon" href="/resources/favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="<?php echo $title; ?>">
    <meta property="og:description" content="<?php echo $preview; ?>">
    <meta property="og:url" content="<?php echo $url; ?>">
    <?php
        // Use absolute URLs for social preview images so crawlers (Discord, Twitter)
        // can fetch them reliably. Prefer microblog images when present, otherwise
        // fall back to a site preview image.
        if ($has_image) {
            $imgAbs = 'https://fridg3.org/microblog/images/' . rawurlencode($has_image);
        } else {
            $imgAbs = '';
        }
    ?>
    <meta property="og:image" content="<?php echo $imgAbs; ?>">
    <meta name="twitter:image" content="<?php echo $imgAbs; ?>">
    <link rel="image_src" href="<?php echo $imgAbs; ?>">


    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?php echo $title; ?>">
    <meta name="twitter:description" content="<?php echo $preview; ?>">

    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
</head>
<body>
<div class="container">
    <script src="/theme.js"></script>
    <button id="change-theme"><i class="fa-solid fa-palette"></i></button>
    <center>
        <h1><a href="https://fridg3.org">fridge</a></h1>
        <a href="https://fridg3.org/microblog">[micro]</a><a href="https://fridg3.org/blog">blog</a>
        <a href="https://fridg3.org/about">about</a>
        <a href="https://fridg3.org/contact">contact</a>
        <a href="https://fridg3.org/projects">projects</a>
        <a href="https://fridg3.org/music">music</a>
    </center>
<br>
<h3>microblog</h3>
<h4><a href='/microblog'>back to /microblog/</a></h4>
<br>
    <div class="microblog-post">
        <span id="microblog-user"><?php echo $userSafe; ?></span> <span id="microblog-username"><?php echo $displayUsername; ?></span> <span id="microblog-date"><?php echo $date; ?></span><br>
        <p><?php echo $text; ?></p>
    </div>
</div>
</body>
</html>

