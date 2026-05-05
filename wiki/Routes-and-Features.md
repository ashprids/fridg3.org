# Routes and Features

## Core Content Routes

### `/`

homepage with dynamic latest feed, latest journal, and music cards.

### `/feed`

- list/search/paginate feed posts from `data/feed/*.txt`
- create visibility depends on admin or `allowedPages` containing `feed`
- writes derived `index.toml`
- `@mentions` in BBCode are highlighted client-side for notification-aware feed posts

Related:

- `/feed/create`
- `/feed/edit`
- `/feed/posts/{id}`

### `/feed/posts/{id}`

- single-post thread view for a feed item
- logged-in users can reply with BBCode and image uploads
- reply edit/delete is allowed for the reply author, admins, the original post owner, or accounts with `allowedPages` containing `comments`
- replies persist under `data/feed/replies/{postId}.json`

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
- supports feed, journal, and newsletter bookmark ids

### `/settings`

- UI shell only
- persistence handled by `/api/settings`
- includes theme/glow settings and mobile-friendly-view preference
- shows a Discord linking action for logged-in users and disables it once `discordUserId` is already linked

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
- users with `mustResetPassword` are redirected into the password-change flow before using the rest of the site

### `/account/logout`

destroys session and auth cookies, then redirects back to login.

### `/account/create`

admin-only account creation flow that writes to `data/accounts/accounts.json`.

- can seed `discordUserId`
- can grant `comments` permission
- newly created accounts are flagged with `mustResetPassword`
- if a Discord id is provided, it asks the local toast bot to DM the invite credentials

### `/account/change-password` and `/account/password`

both update the current user password hash in `accounts.json`.

- first-login forced password reset lands here via `?first_login=1`

### `/account/link-discord`

- logged-in-only Discord linking flow
- validates the Discord user id, checks uniqueness across accounts, and asks the local toast bot to verify the member is in the server
- stores `discordUserId` on the account and assigns the Discord `registered` role through the bot

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
- includes `comments` as a grantable `allowedPages` permission
- password resets now preserve the account and flip `mustResetPassword` back on

Helpers live in `account/admin/helpers.php`.

## Email / Newsletter Routes

### `/email`

contact page wrapper.

### `/email/newsletter`

archive page for published newsletter HTML files in `data/newsletter/*.html`.

- newsletter cards can be bookmarked like feed/journal entries

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

- `/others/mdpaste`
- `/others/off-topic-archive`
- `/others/toast-discord-bot`
- `/others/fridge-builds-websites`

### `/others/mdpaste`

standalone markdown paste service for sharing notes without exposing a whole vault.

- accepts pasted markdown or client-loaded `.md` / `.txt` files
- live previews markdown before publishing
- supports normal markdown images plus Obsidian-style `![[image.png]]` embeds that point at `/data/images`
- optional hard-break mode keeps single line breaks in formatted paragraphs
- `POST /others/mdpaste/` writes temporary paste JSON under `data/mdpaste`
- optional password mode encrypts the markdown with AES-256-GCM before storage
- shared links render from `/others/mdpaste/s/{pasteId}`
- pastes expire after 30 days

### `/others/off-topic-archive`

frontend archive viewer backed by `data/etc/off-topic-archive.json`.

### `/others/toast-discord-bot`

UI shell for toast bot status, controls, and stream playback.

### `/others/toast-discord-bot/messages`

- admin-only DM inbox/sender for toast
- reads tracked DM history, resolves linked website usernames to Discord ids, and can send outbound DMs through the local bot service

### `/others/fridge-builds-websites`

wrapper/marketing page for custom website work. this exists in code even though the older docs mostly ignored it.

## Formatting / Examples / Errors

- `/formatting`
- `/formatting/example_page`
- `/error/403`
- `/error/404`
- `/error/50x`
- `/error/wip`
