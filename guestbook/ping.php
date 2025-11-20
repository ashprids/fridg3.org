<?php
// Lightweight ping endpoint used by the guestbook client to measure RTT.
// Returns a minimal 200 OK with no body.
// Kept intentionally tiny to avoid routing or JSON parsing issues.
http_response_code(200);
header('Content-Type: text/plain; charset=utf-8');
echo "OK";
exit;
