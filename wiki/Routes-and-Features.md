# Routes and Features

## Core Content Routes

### `/`

homepage with dynamic latest feed, latest journal, and music cards.

### `/feed`

- list/search/paginate feed posts from `data/feed/*.txt`
- create visibility depends on admin or `allowedPages` containing `feed`
- writes derived `index.toml`

Related:

- `/feed/create`
- `/feed/edit`
- `/feed/posts/{id}`

### `/journal`

- list/search/paginate journal posts from `data/journal/*.txt`
- create visibility depends on admin or `allowedPages` containing `journal`
- published journal bodies are trusted HTML
- preview/edit flows support draft files and optional `FORMAT:html`

Related:

- `/journal/create`
- `/journal/create/preview`
- `/journal/edit`
- `/journal/edit/preview`
- `/journal/posts/{id}`

### `/guestbook`

- list entries from `data/guestbook/*.txt`
- one-post-per-IP gate via `data/guestbook/ip_index.json`
- owner/admin edit and delete flow

Related:

- `/guestbook/create`
- `/guestbook/edit`

### `/music`

- builds album grids from `data/music/frdg3/*.json` and `data/music/cactile/*.json`
- songs reference `data/audio/*`
- integrates with the shared mini player

### `/gallery`

- paginated listing of `data/images/*`
- admin delete actions call `/api/gallery/delete`

### `/bookmarks`

- server-rendered bookmark listing for logged-in users
- client-side localStorage enhancement for anonymous users
- supports feed and journal bookmark ids

### `/settings`

- UI shell only
- persistence handled by `/api/settings`
- includes theme/glow settings and mobile-friendly-view preference

## Account Routes

### `/account`

currently just redirects:

- logged in -> `/`
- logged out -> `/account/login`

### `/account/login`

- secure session config
- CSRF protection
- login throttling via `data/accounts/login_attempts.json`
- reads `data/accounts/accounts.json`
- sets session user payload and `is_admin` cookie

### `/account/logout`

destroys session and auth cookies, then redirects back to login.

### `/account/create`

admin-only account creation flow that writes to `data/accounts/accounts.json`.

### `/account/change-password` and `/account/password`

both update the current user password hash in `accounts.json`.

### `/account/admin`

not covered in the older references, but very real.

- admin-only account directory
- reads all accounts and renders permission badges
- links to per-account edit page

### `/account/admin/edit`

- admin-only account editor
- supports rename, display-name change, permission changes, reset password, and delete
- preserves unknown extra account fields through an editable JSON object field
- blocks deleting the currently logged-in account

Helpers live in `account/admin/helpers.php`.

## Email / Newsletter Routes

### `/email`

contact page wrapper.

### `/email/newsletter`

archive page for published newsletter HTML files in `data/newsletter/*.html`.

Related:

- `/email/newsletter/create`
- `/email/newsletter/create/preview`
- `/email/newsletter/preview`
- `/email/newsletter/release/{id}`

Mailing-list status wrappers:

- `/email/mailinglist/subscribe`
- `/email/mailinglist/unsubscribe`
- `/email/mailinglist/invalid`
- `/email/mailinglist/error`

## Other Public Routes

### `/discord`

simple wrapper page for the Discord community entry point.

### `/merch`

simple wrapper page for merch links/content.

### `/others`

misc landing page for routes that do not fit elsewhere.

Subroutes:

- `/others/off-topic-archive`
- `/others/toast-discord-bot`
- `/others/fridge-builds-websites`

### `/others/off-topic-archive`

frontend archive viewer backed by `data/etc/off-topic-archive.json`.

### `/others/toast-discord-bot`

UI shell for toast bot status, controls, and stream playback.

### `/others/fridge-builds-websites`

wrapper/marketing page for custom website work. this exists in code even though the older docs mostly ignored it.

## Formatting / Examples / Errors

- `/formatting`
- `/formatting/example_page`
- `/error/403`
- `/error/404`
- `/error/50x`
- `/error/wip`
