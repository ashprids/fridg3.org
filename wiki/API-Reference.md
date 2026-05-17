# API Reference

all API routes live under `/api/*` and are handled by PHP.

## Auth And Account

### `/api/account/is-admin`

- returns `{ isAdmin: boolean }`
- refreshes frontend admin awareness for maintenance-mode bypass logic

### `/api/settings`

`GET`

- requires logged-in user
- returns current settings from `data/accounts/accounts.json`
- currently exposes `theme`, `glowIntensity`, `colors`, `mobileFriendlyView`, and `onekoEnabled`

`POST`

- requires logged-in user
- updates user settings in `accounts.json`
- can set `theme` to `default`, `classic`, or a valid `/themes/*.json` theme id
- can set `mobileFriendlyView` and sync the `mobile_friendly_view` cookie
- can set `onekoEnabled` for the optional cursor-following cat
- syncs the `theme_pref` cookie so anonymous and first-load rendering can pick the active theme
- validates color fields as `#RRGGBB`; the settings UI only sends color fields for `classic`
- admin users can also toggle maintenance mode through the settings flow

### `/api/themes`

`GET`

- public route
- returns selectable themes, with `default` displayed as `blackprint` before discovered themes
- each valid theme must include `name`, `html`, and `css`
- theme `html` and `css` paths are resolved from `/themes/lib`

### `/api/bookmark`

`POST` only.

- requires logged-in user for server persistence
- supports single toggle via `postId`
- supports full replacement via `bookmarks`
- writes normalized bookmark ids back to `accounts.json`
- bookmark ids currently include raw feed ids and `journal:{id}`; legacy `newsletter:{id}` values may exist but are ignored
- anonymous bookmarking is handled client-side in localStorage instead

## Content / Media

### `/others/mdpaste/`

`POST` JSON payload with `{ markdown, password, hardBreaks }`.

- stores temporary markdown paste records in `data/mdpaste`
- empty passwords create public pastes
- non-empty passwords encrypt the markdown before storage
- `hardBreaks` stores whether single line breaks render as line breaks in formatted paragraphs
- returns `{ ok, id, url, expires_at, encrypted }`
- rejects blank pastes and content over 512 KiB

### `/api/feed-post`

- returns parsed feed post JSON for a supplied `?id=`
- does not expose replies; thread replies are loaded directly by `/feed/posts/{id}` from `data/feed/replies/*.json`

### `/api/gallery/delete`

- admin-only image deletion from `data/images`
- validates filename/path and allowed image extensions

### `/api/sitemap`

- admin-only sitemap generator
- scans routes and content files
- writes `/sitemap.xml`

## Toast / Stream / Status

### `/api/discord-bot-status`

- reads `data/etc/toast.json`
- returns bot and stream status payload for UI consumers

### `/api/discord-bot-control`

`POST` JSON payload with stream info.

- updates stream URL and name in `data/etc/toast.json`
- writes a stream update signal for downstream consumers

### `/api/discord-bot-control/status`

`POST` JSON payload with bot status.

- updates bot online/offline state in `data/etc/toast.json`

### `/api/stream-proxy`

- same-origin proxy for stream audio playback
- host-restricted based on configured stream host
- used by toast playback UI

## Telemetry / System

### `/api/page-view`

`POST` JSON payload with `{ path }`.

- normalizes route path
- rejects `/api/*` paths
- hashes client IP before storage
- updates `data/etc/page_views.json`
- returns updated page count

### `/api/system/usage`

- returns CPU, memory, and disk usage data
- includes Linux and Windows code paths

## Implementation Notes

- most endpoints return JSON and perform direct file IO
- write-heavy endpoints should be treated carefully because there is no database transaction safety blanket here
- `/api/page-view` already uses file locking, which is the sane move
- some account, contact, and toast integrations also talk to a localhost-only bot HTTP service on `127.0.0.1:8765`, but those are not public `/api/*` routes
- contact submissions call `POST /contact/notify` on that local toast service after successful storage so toast can notify the configured Discord channel
