<?php
$id = basename($_GET['id']);
$file = __DIR__ . "/posts/$id.txt";

if (!file_exists($file)) {
    http_response_code(404);
    $error = file_get_contents(__DIR__ . "/404.html");
    echo $error;
}

$lines = file($file, FILE_IGNORE_NEW_LINES);
$user = $lines[0] ?? "fridge";
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
$title = "fridge | microblog post from $date";
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
    <?php if ($has_image): ?>
        <meta property="og:image" content="images/<?php echo $has_image; ?>">
        <meta name="twitter:image" content="images/<?php echo $has_image; ?>">
    <?php else: ?>
        <meta property="og:image" content="preview.jpg">
        <meta name="twitter:image" content="preview.jpg">
    <?php endif; ?>


    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="<?php echo $title; ?>">
    <meta name="twitter:description" content="<?php echo $preview; ?>">
    <meta name="twitter:image" content="preview.jpg">

    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
</head>
<body>
<div class="container">
    <script src="/theme.js"></script>
    <button id="change-theme"><i class="fas fa-sun"></i></button>
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
        <b><?php echo $user; ?></b> <span id="microblog-date"><?php echo $date; ?></span><br>
        <p><?php echo $text; ?></p>
    </div>
</div>
</body>
</html>

