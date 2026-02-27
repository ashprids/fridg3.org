# fridg3.org — Developer Reference (Human-Friendly)

This is the practical version of the technical reference: where things live, what to edit, and what to avoid breaking.

---

## TL;DR (Start Here)

- Pages are mostly `index.php` + `content.html` pairs.
- Global wrapper is `template.html`.
- Most route logic is server-rendered in PHP; behavior polish and interactivity live in `main.js`.
- Persistent runtime content is under `/data` (not pushed like normal source files).
- If you need to change content layout: edit `content.html` for that route.
- If you need to change data flow, permissions, pagination, search, or writes: edit that route’s `index.php`.

---

## 1) How the Site Renders

### Standard route pattern
Most routes do this in `index.php`:
1. `session_start()`
2. Set page metadata (`$title`, `$description`)
3. Load root `template.html`
4. Load local route `content.html`
5. Inject placeholders and dynamic content
6. Echo final HTML

### Core shared files
- `template.html`: shared shell (sidebar, footer, scripts, `{content}` placeholder)
- `main.js`: frontend app behaviors (SPA-like nav, settings UI, bookmark interactions, toast controls, archive rendering)
- `style.css`: global design and component styling

### Session/auth basics
- Logged-in user state is `$_SESSION['user']`.
- Many pages do literal string replacement to swap the account footer icon to logout.
- Cookie `is_admin` is used by frontend logic (especially maintenance/WIP behavior), but backend auth checks are still in PHP.

---

## 2) Route Map (What each page does)

## 2.1 Root / shared
- `/` → `index.php` + `content.html`
  - injects latest feed, latest journal, latest music

## 2.2 Account
- `/account/index.php`
  - currently redirects (logged in -> `/`, not logged in -> `/account/login`)
- `/account/login/index.php` + `content.html`
  - CSRF + throttling + login + session bootstrap
- `/account/logout/index.php`
  - destroys session/cookies, redirects to login with `?logged_out=1`
- `/account/create/index.php` + `content.html`
  - admin-only account creation
- `/account/change-password/index.php` + `content.html`
- `/account/password/index.php` + `content.html`
  - both update current user password in accounts data

## 2.3 Feed
- `/feed/index.php` + `content.html`
  - list/search/pagination from `/data/feed/*.txt`
- `/feed/create/index.php` + `content.html`
  - create post + upload images + optional Discord webhook
- `/feed/edit/index.php` + `content.html`
  - owner/admin edit and delete
- `/feed/posts/index.php` + `content.html`
  - single feed post page

## 2.4 Journal
- `/journal/index.php` + `content.html`
  - list/search/pagination from `/data/journal/*.txt`
- `/journal/create/index.php` + `content.html`
  - create post, manage drafts, upload images, BBCode conversion
- `/journal/posts/index.php` + `content.html`
  - single journal post renderer

## 2.5 Guestbook
- `/guestbook/index.php` + `content.html`
  - list entries + pagination + owner/admin edit/delete controls
- `/guestbook/create/index.php` + `content.html`
  - one post per IP (tracked by `ip_index.json`)
- `/guestbook/edit/index.php` + `content.html`
  - owner/admin edit flow

## 2.6 Email + Newsletter
- `/email/index.php` + `content.html`
  - contact page shell
- `/email/newsletter/index.php` + `content.html`
  - release archive from `/data/newsletter/*.html`
- `/email/newsletter/create/index.php` + `content.html`
- `/email/newsletter/create/preview/index.php` + `content.html`
- `/email/newsletter/preview/index.php` + `content.html`
- `/email/newsletter/release/index.php` + `content.html`
  - display one published newsletter HTML
- status pages (wrapper pages):
  - `/email/mailinglist/subscribe`
  - `/email/mailinglist/unsubscribe`
  - `/email/mailinglist/invalid`
  - `/email/mailinglist/error`

## 2.7 Other content areas
- `/music/index.php` + `content.html` (album grids from `/data/music/*`)
- `/gallery/index.php` + `content.html` (images from `/data/images`, admin delete)
- `/bookmarks/index.php` + `content.html` (saved feed/journal posts)
- `/settings/index.php` + `content.html` (UI shell; persistence via `/api/settings`)
- `/others/index.php` + `content.html` (wrapper)
- `/others/off-topic-archive/index.php` + `content.html` (JS loads archive JSON)
- `/others/toast-discord-bot/index.php` + `content.html` (toast bot control shell)

## 2.8 Formatting + static error pages
- `/formatting/index.php` + `content.html`
- `/formatting/example_page/index.php` + `content.html`
- static (no PHP templating):
  - `/error/403/index.html`
  - `/error/404/index.html`
  - `/error/50x/index.html`
  - `/error/wip/index.html`

---

## 3) API Endpoints (Operational Summary)

- `/api/account/is-admin` → returns admin status JSON
- `/api/bookmark` → update user bookmark list
- `/api/feed-post` → fetch parsed single feed post
- `/api/gallery/delete` → admin image delete
- `/api/newsletter/publish` → save newsletter HTML file
- `/api/settings` → get/set user settings; admin can toggle maintenance
- `/api/sitemap` → admin sitemap generation
- `/api/system/usage` → CPU/memory/disk data
- `/api/discord-bot-status` → read toast status config
- `/api/discord-bot-control` → update stream url/name
- `/api/discord-bot-control/status` → toggle toast bot online/offline
- `/api/stream-proxy` → same-origin stream proxy

---

## 4) “If you need to change X, edit Y”

- Update page copy/layout for one route
  - edit that route’s `content.html`
- Add new route-level dynamic behavior
  - edit that route’s `index.php`
- Add global nav/footer/script include
  - edit `template.html`
- Change visual theme/system styles
  - edit `style.css`
- Change interaction behavior (bookmarks/settings/toast/archive/SPA nav)
  - edit `main.js`
- Change persisted settings, permissions, or writes
  - edit PHP writer + corresponding data schema under `/data`

---

## 5) `/data` Contract (What must exist in production/dev)

`/data` is runtime content and should be maintained outside normal repo commits.

## 5.1 `/data/accounts/`

### `accounts.json`
```json
{
  "accounts": [
    {
      "username": "string",
      "name": "string",
      "password": "bcrypt-hash or empty",
      "isAdmin": true,
      "allowedPages": ["feed", "journal"],
      "bookmarks": ["2026-01-01_12-00-00", "journal:12"],
      "glowIntensity": "none|low|medium|high",
      "colors": {
        "bg": "#RRGGBB",
        "fg": "#RRGGBB",
        "border": "#RRGGBB",
        "subtle": "#RRGGBB",
        "links": "#RRGGBB"
      }
    }
  ]
}
```

### `login_attempts.json`
- map of IP -> array of unix timestamps

## 5.2 `/data/feed/`
- post file format (`*.txt`):
  1. `@username`
  2. `YYYY-MM-DD HH:MM:SS`
  3. post body text/BBCode
- derived `index.toml` is generated server-side

## 5.3 `/data/journal/`
- published post (`N.txt`):
  1. date
  2. title
  3. subtitle/description
  4+. trusted HTML body
- draft (`/data/journal/drafts/*.txt`):
  1. `USER:<username>`
  2. title
  3. description
  4+. BBCode body

## 5.4 `/data/guestbook/`
- entry (`*.txt`): timestamp, name, message
- `ip_index.json`: IP -> filename (one-post-per-IP gate)

## 5.5 `/data/images/`
- uploaded images for feed/journal/gallery/newsletters
- referenced by `/data/images/<filename>`

## 5.6 `/data/music/`
- current artist folders: `frdg3`, `cactile`
- album JSON shape:
```json
{
  "album_name": "string",
  "album_caption": "string",
  "album_type": "Album|EP|Single|Remix|...",
  "album_art": "/data/images/example.jpg",
  "album_art_directory": "/data/images/example.jpg",
  "order": 6,
  "songs": [{ "name": "Track", "directory": "/data/audio/file.wav" }]
}
```

## 5.7 `/data/audio/`
- track files referenced by music metadata

## 5.8 `/data/newsletter/`
- published newsletter bodies as `{id}.html` (commonly `YYYY-MM-DD.html`)

## 5.9 `/data/etc/`
- `wip` → maintenance mode flag
- `webhooks.json` → includes `discord_feed`
- `toast.json` → bot/stream/channel/features config
- `toast-updates.json` → status history array
- `off-topic-archive.json` → Discord export blob

## 5.10 `/data/downloads/`
- binary/download artifacts linked by pages

---

## 6) Gotchas to Keep in Mind

- Footer account/logout swap depends on exact HTML string matching in many route files.
- Bookmark persistence uses `accounts.json` (legacy `/data/users` patterns still appear in some code paths).
- Feed and journal store content differently:
  - feed = text/BBCode
  - journal = HTML body in published files
- Newsletter publish endpoint is `/api/newsletter/publish`.
- `main.js` is large and route-sensitive: test SPA navigation after shared JS edits.

---

## 7) Safe Change Workflow

1. Identify scope (`content.html` only vs server logic vs API vs global shell).
2. Apply smallest edit in correct layer.
3. If touching persistence, update read + write + defaults.
4. Re-test the specific route plus one adjacent route (to catch shared shell/JS side effects).
5. For admin-sensitive paths, verify backend checks exist in PHP.

---

## 8) Full Coverage Reminder

For broad refactors, review all of:
- root: `index.php`, `template.html`, `content.html`, `main.js`, `style.css`
- `account/**/index.php` + route templates
- `feed/**`, `journal/**`, `guestbook/**`, `email/**`
- `music`, `gallery`, `bookmarks`, `settings`, `others`, `formatting`
- all `api/**/index.php`
- static errors in `error/**/index.html`

This keeps changes safe across server-rendered, JS-enhanced, and data-backed routes.
