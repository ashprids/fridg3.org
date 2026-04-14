# Architecture

## High-Level Shape

the site is a classic folder-routed PHP app with a shared shell and file-based storage.

usual pattern:

1. bootstrap shared session handling via `lib/session.php`
2. set `$title` and `$description`
3. locate the preferred template
4. load route-local `content.html`
5. inject dynamic placeholders
6. echo final HTML

## Shared Building Blocks

- `template.html`
  default desktop shell with sidebar, footer, placeholders, and global asset includes
- `template_mobile.html`
  alternate shell for mobile-friendly view
- `lib/render.php`
  shared helpers for upward file lookup and mobile template selection
- `lib/session.php`
  shared session bootstrap, persistent cookie config, `mustResetPassword` enforcement, and admin-cookie refresh helper
- `lib/feed.php`
  feed-specific helpers for reply persistence, permission checks, datetime formatting, and inline image upload replacement
- `main.js`
  shared client behavior layer
- `style.css`
  global styling and component rules

## Template Selection

mobile/desktop template choice is centralized in `lib/render.php`.

mobile mode is enabled when any of these are true:

- host is `m.fridg3.org`
- cookie `mobile_friendly_view` is truthy
- logged-in account has `mobileFriendlyView: true` in `data/accounts/accounts.json`

if the mobile template is requested but missing, routes fall back to `template.html`.

## Session And Auth Model

- logged-in state lives in `$_SESSION['user']`
- frontend admin awareness uses a non-HttpOnly `is_admin` cookie
- backend authorization is still done in PHP, which is correct and non-cursed

common session fields:

- `username`
- `name`
- `isAdmin`
- `mustResetPassword`
- `allowedPages`

## Persistence Model

there is no database. the app reads and writes JSON, TXT, HTML, and media files under `/data`.

main stores:

- `data/accounts/accounts.json`
- `data/accounts/login_attempts.json`
- `data/feed/*.txt`
- `data/feed/replies/*.json`
- `data/journal/*.txt`
- `data/journal/drafts/*.txt`
- `data/guestbook/*.txt`
- `data/newsletter/*.html`
- `data/etc/*.json`

## Important Couplings

- many routes still do literal string replacement on the footer account button to swap login/logout
- `main.js` assumes certain DOM ids exist across templates
- bookmarks are stored in `accounts.json`, but some old code paths still reference a legacy `/data/users` pattern
- newsletter releases are HTML files in `data/newsletter/*.html`, and bookmark metadata for them is derived from that rendered HTML rather than a sidecar JSON index
- toast’s Discord bot is not just a stream bot anymore; it also maintains local DM history plus feed notification state under `data/etc/`
- page views are updated from shared frontend flow, so nav changes can silently break view counts
