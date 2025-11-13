<?php
function loadPosts($limit = 5, $page = 1, $query = null) {
    $files = glob(__DIR__ . "/posts/*.txt");
    rsort($files);

    // If a search query is provided, filter files that contain the query
    if ($query && strlen(trim($query)) > 0) {
        $q = mb_strtolower(trim($query));
        $filtered = [];
        foreach ($files as $f) {
            $content = @file_get_contents($f);
            if ($content !== false && mb_stripos($content, $q) !== false) {
                $filtered[] = $f;
            }
        }
        $files = $filtered;
    }

    $total = count($files);
    $total_pages = $total > 0 ? ceil($total / $limit) : 1;
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
            // preserve query in pagination links
            $qparam = $query ? '&q=' . urlencode($query) : '';
            $output .= "<a href='?page=$next" . $qparam . "'>next &raquo;</a>";
        }
        $output .= "</div>";
    }

    return $output;
}

// load template
$template = file_get_contents(__DIR__ . "/template.html");
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$query = isset($_GET['q']) ? trim((string)$_GET['q']) : null;

$posts_html = loadPosts(5, $page, $query);

// build search form HTML to inject into template
$safeQ = $query !== null ? htmlspecialchars($query, ENT_QUOTES) : '';
$scriptPath = isset($_SERVER['SCRIPT_NAME']) ? htmlspecialchars($_SERVER['SCRIPT_NAME'], ENT_QUOTES) : 'index.php';
$search_html = "<div id='microblog-search' style='margin:10px 0 18px; text-align:center;'>";
$search_html .= "<form method='get' action='" . $scriptPath . "' style='display:flex;justify-content:center;'>";
// Wrap controls in a .contact-form container so theme rules targeting
// `.contact-form input` and `.contact-form button` apply. Use flex so
// the control group can be centered and the input can grow to fill space.
 $search_html .= "<div class='contact-form' style='display:flex;align-items:center;gap:0;flex-direction:row;padding:0;margin:0;width:100%;box-sizing:border-box;'>";
 $search_html .= '<input type="search" name="q" placeholder="search /microblog/ for.." value="' . $safeQ . '" style="font-family: \'MainRegular\', monospace; font-size:0.8rem; flex:1; width:85%; min-width:0; box-sizing:border-box; height:32px; line-height:1.1; margin-left:0; margin-right:0;" />';
 $search_html .= '<button type="submit" style="margin-left:0; margin-right:0; padding:6px 10px; border-radius:0; font-family: \'MainBold\', monospace; font-size:1rem; cursor:pointer; width:15%; height:32px; display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box;">search</button>';
$search_html .= "</div>";
$search_html .= "</form></div>";

// inject into template
$out = str_replace("{{microblog_posts}}", $posts_html, $template);
$out = str_replace("{{microblog_search}}", $search_html, $out);
echo $out;
?>

