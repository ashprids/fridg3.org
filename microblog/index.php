<?php
function loadPosts($limit = 5, $page = 1) {
    $files = glob(__DIR__ . "/posts/*.txt");
    rsort($files);

    $total = count($files);
    $total_pages = ceil($total / $limit);
    $page = max(1, min($page, $total_pages));

    $start = ($page - 1) * $limit;
    $files = array_slice($files, $start, $limit);

    $output = "";

    foreach ($files as $file) {
        $lines = file($file, FILE_IGNORE_NEW_LINES);
        $user = $lines[0] ?? "fridge";
        $date = $lines[1] ?? "";
        $body = array_slice($lines, 2);
        $id = basename($file, ".txt"); // filename without .txt

        // handle embedded image
        $has_image = null;
        foreach ($body as $i => $line) {
            if (str_starts_with($line, "[IMAGE:")) {
                $has_image = trim(str_replace(["[IMAGE:", "]"], "", $line));
                unset($body[$i]); // remove the image line from text
            }
        }

        // reindex the array just in case
        $body = array_values($body);
        $body_html = "<p>" . implode("<br>", $body);

if ($has_image) {
    $body_html .= "<br><br><a href='/microblog/images/$has_image'><img id='microblog-image' src='/microblog/images/$has_image' style='max-width: 100%; border-radius: 0px;'></a>";
}

$body_html .= "</p>";


        $output .= "<div class='microblog-post'>
                        <b>$user</b> <span><a id='microblog-date' href='post.php?id=$id'>$date</a></span><br>
                        $body_html
                    </div><hr>";
    }

    // Pagination
    if ($total_pages > 1) {
        $output .= "<div class='pagination'>";
        if ($page > 1) {
            $prev = $page - 1;
            $output .= "<a href='?page=$prev'>&laquo; prev</a>&nbsp;";
        }
        if ($page < $total_pages) {
            $next = $page + 1;
            $output .= "<a href='?page=$next'>next &raquo;</a>";
        }
        $output .= "</div>";
    }

    return $output;
}

// load template
$template = file_get_contents(__DIR__ . "/template.html");
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$posts_html = loadPosts(5, $page);

// inject into template
echo str_replace("{{microblog_posts}}", $posts_html, $template);
?>

