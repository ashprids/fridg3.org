<?php
declare(strict_types=1);

$contentPath = __DIR__ . DIRECTORY_SEPARATOR . 'content.html';

if (!is_file($contentPath) || !is_readable($contentPath)) {
	http_response_code(404);
	header('Content-Type: text/plain; charset=utf-8');
	echo 'content.html not found. this shouldn\'t happen. please report this to me@fridg3.org.';
	exit;
}

header('Content-Type: text/html; charset=utf-8');
readfile($contentPath);

