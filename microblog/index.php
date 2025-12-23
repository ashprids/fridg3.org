<?php
// Username mapping for display
$username_map = [
    'fridge' => '@fridgestuff',
    'freezer' => '@yaztastrophe'
];

// Reverse map: handle (without @) -> canonical user key
$handle_lookup = [];
foreach ($username_map as $user => $handle) {
    $clean = mb_strtolower(ltrim((string)$handle, '@'));
    if ($clean !== '') $handle_lookup[$clean] = mb_strtolower($user);
}

// Microblog count (set when index is built/loaded)
$microblog_count = 0;

// Build a JSON index of posts for fast searching. The index is lazily
// rebuilt when missing or when any post file is newer than the index.
function build_posts_index($postsDir, $indexPath) {
    $files = glob($postsDir . "/*.txt");
    if (!$files) $files = [];
    rsort($files);

    $index = [];
    foreach ($files as $file) {
        $lines = @file($file, FILE_IGNORE_NEW_LINES);
        if (!$lines) continue;
        $user = $lines[0] ?? 'fridge';
        $date = $lines[1] ?? '';
        $bodyLines = array_slice($lines, 2);

        $has_image = null;
        foreach ($bodyLines as $i => $line) {
            if (strpos($line, '[IMAGE:') === 0) {
                $has_image = trim(str_replace(['[IMAGE:', ']'], '', $line));
                unset($bodyLines[$i]);
            }
        }
        $bodyLines = array_values($bodyLines);

        // sanitize image filename to a safe subset
        if ($has_image !== null) {
            $has_image = preg_replace('/[^A-Za-z0-9._-]/', '', $has_image);
            if ($has_image === '') $has_image = null;
        }

        // build searchable text (lowercased) and excerpts/body HTML
        $fulltext = mb_strtolower(implode(' ', array_merge([$user, $date], $bodyLines)));
        // safe full body with line breaks preserved
        $safeBodyLines = array_map(function($line) {
            return htmlspecialchars($line, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }, $bodyLines);
        $body_html = implode('<br>', $safeBodyLines);
        // short excerpt (first 5 lines) for non-search listings
        $excerptLines = array_slice($safeBodyLines, 0, 5);
        $excerpt = implode('<br>', $excerptLines);

        $id = basename($file, '.txt');
        $index[] = [
            'id' => $id,
            'user' => $user,
            'date' => $date,
            'excerpt' => $excerpt,
            'body_html' => $body_html,
            'image' => $has_image,
            'text' => $fulltext,
            'mtime' => filemtime($file)
        ];
    }

    // write atomically
    $tmp = $indexPath . '.tmp';
    @file_put_contents($tmp, json_encode($index, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    @rename($tmp, $indexPath);
    return [
        'index' => $index,
        'count' => count($index)
    ];
}

function loadPosts($limit = 5, $page = 1, $query = null) {
    global $username_map, $microblog_count, $handle_lookup;
    $postsDir = __DIR__ . '/posts';
    $indexPath = $postsDir . '/index.json';

    // rebuild index if missing or stale
    $needBuild = false;
    if (!file_exists($indexPath)) $needBuild = true;
    else {
        $idxMtime = filemtime($indexPath);
        $files = glob($postsDir . '/*.txt');
        foreach ($files as $f) {
            if (filemtime($f) > $idxMtime) { $needBuild = true; break; }
        }
    }
    if ($needBuild) {
        $buildResult = build_posts_index($postsDir, $indexPath);
        $index = $buildResult['index'];
        $microblog_count = $buildResult['count'];
    } else {
        $index = @json_decode(@file_get_contents($indexPath), true) ?: [];
        $microblog_count = is_array($index) ? count($index) : 0;
    }

    // apply search filter on index (text field). limit query length to 200 chars
    $isHandleSearch = false;

    if ($query) {
        $q = mb_substr(trim((string)$query), 0, 200);
        $qLower = mb_strtolower($q);

        // If the query looks like a handle (@name or name), map to a user and
        // filter by that user. Otherwise, fall back to full-text search.
        $handleKey = ltrim($qLower, '@');
        $userMatch = $handle_lookup[$handleKey] ?? null;

        if ($userMatch !== null) {
            $filtered = array_filter($index, function($item) use ($userMatch) {
                return mb_strtolower($item['user'] ?? '') === $userMatch;
            });
            $index = array_values($filtered);
            $isHandleSearch = true;
        } else {
            $filtered = array_filter($index, function($item) use ($qLower) {
                return mb_stripos($item['text'] ?? '', $qLower) !== false;
            });
            $index = array_values($filtered);
        }
    }

    $total = count($index);
    // For handle searches, show all matches without pagination.
    if ($isHandleSearch) {
        $total_pages = 1;
        $page = 1;
        $slice = $index;
    } else {
        $total_pages = $total > 0 ? ceil($total / $limit) : 1;
        $page = max(1, min($page, $total_pages));

        $start = ($page - 1) * $limit;
        $slice = array_slice($index, $start, $limit);
    }

    $output = '';
    foreach ($slice as $item) {
        $id = htmlspecialchars($item['id'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $user = htmlspecialchars($item['user'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $displayUsername = htmlspecialchars($username_map[$item['user']] ?? '@' . $item['user'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $date = htmlspecialchars($item['date'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $excerpt = $item['excerpt']; // already escaped when building index

        // If this request is a search (query provided), show the full safe body_html;
        // otherwise show the shorter excerpt to keep list compact.
        if (!empty($query) && !empty($item['body_html'])) {
            $body_html = '<p>' . $item['body_html'];
        } else {
            $body_html = '<p>' . $excerpt;
        }
        if (!empty($item['image'])) {
            $imgUrl = '/microblog/images/' . rawurlencode($item['image']);
            $body_html .= "<br><br><a href='" . $imgUrl . "'><img id='microblog-image' src='" . $imgUrl . "' style='max-width: 100%; border-radius: 0px;'></a>";
        }
        $body_html .= '</p>';

        $output .= "<div class='microblog-post' onclick=\"window.location='post.php?id=$id'\" style='cursor:pointer;'>\n" .
               "<span id='microblog-user'>$user</span> <span id='microblog-username'>$displayUsername</span> <span id='microblog-date'>$date</span><br>\n" .
               $body_html . "\n</div><hr>";
    }

    // Pagination
    if (!$isHandleSearch && $total_pages > 1) {
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
$out = str_replace("{{microblog_count}}", (string)$microblog_count, $out);
$out = str_replace("{{microblog_search}}", $search_html, $out);
echo $out;
?>

