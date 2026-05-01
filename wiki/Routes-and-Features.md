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
- if that DM fails, the account is still created and the UI now shows the bot's concrete failure reason instead of a generic HTTP 500

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

- `/others/off-topic-archive`
- `/others/toast-discord-bot`
- `/others/fridge-builds-websites`
- `/others/fridgeBeats`

### `/others/off-topic-archive`

frontend archive viewer backed by `data/etc/off-topic-archive.json`.

### `/others/toast-discord-bot`

UI shell for toast bot status, controls, and stream playback.

### `/others/toast-discord-bot/messages`

- admin-only DM inbox/sender for toast
- reads tracked DM history, resolves linked website usernames to Discord ids, and can send outbound DMs through the local bot service

### `/others/fridge-builds-websites`

wrapper/marketing page for custom website work. this exists in code even though the older docs mostly ignored it.

### `/others/fridgeBeats`

browser-based mini DAW inspired by simplified FL Studio workflows.

- Web Audio transport with BPM, play/stop, idle-stop panic, record arm, global master volume, waveform scope, and a small level meter
- editable project names
- new project menu can start a blank `Untitled` project or load starter `.frdgbeats` presets from `/others/fridgeBeats/presets/`, including essential genre templates for house, hip-hop, pop songwriting, synthwave, orchestral sketching, and game loops
- load demos menu lists `.frdgbeats` files from `/others/fridgeBeats/demos/`
- channel rack with rename, recolor, mute/solo/remove, up to 128 patterns per instrument with project-wide selectable 16/32-column grids, volume/pan, and add-channel support
- piano roll edits the selected instrument and selected pattern slot, places notes on pointer-down, lets newly placed notes follow vertical pointer movement until release, lets existing notes drag horizontally between steps, previews newly placed notes until pointer release, shows two octaves per octave-page selector, supports chromatic piano-key rows, and stores multiple note events plus configurable snapped hold length, vertical-drag slide notes from resize handles, and right-click velocity per step
- keyboard-to-piano input follows the FL-style `Z/S/X/D/C...` and `Q/2/W/3/E...` layout with extra British QWERTY keys for a wider playable range; held keys sustain until released and preview the selected instrument without starting transport, while `Space` toggles play/pause outside text fields
- piano roll playback previews only the selected instrument and active pattern, while playlist playback follows the full arrangement
- playlist view starts at 4 bar rows, can grow to 128 rows, and has per-row delete buttons; instruments run across the top, clips can choose pattern `1`-`128` or grey disabled `0`, right-click decrements pattern numbers without opening the browser menu, row numbers start playback from that bar, and per-row loop toggles can define a highlighted loop range
- mixer view adds modular per-channel Web Audio effects loaded from `/others/fridgeBeats/effects/`; effect definitions register their own params, presets, node chains, optional custom GUIs, and injected CSS, with minimizable effect cards plus custom delay, reverb, distortion with cabinet voicing, bitcrush, compressor, limiter, flanger, phaser, chorus, instrument pitch shift, sample-only speed/tempo sync, and draggable graph EQ examples with optional precision sliders
- each channel can use a modular synth from `/others/fridgeBeats/synths/`, a sample instrument, or a parsed SoundFont preset bank
- synth instruments register VST-style Web Audio voices with saved params, injected CSS, fixed 4:3 graphical synth-tab interfaces, and bundled Wave Oscillator, Analog Mono, Chip Stack, Glass FM, and Nebula Table wavetable examples with vertical drag controls
- sample instruments can use bundled files from `/others/fridgeBeats/samples/` or a custom upload with a loading popup, one-shot/loop/reverse playback, and a keep-duration toggle for pitch-shifted sample notes; keep-duration renders high-quality Rubber Band pitch buffers in a worker when available and falls back to the classic shifter if wasm cannot load, plus a zoomable, horizontally scrollable waveform tab for graphical start/end trimming, playback tracking, and right-click per-note sample zones
- default SoundFont playback loads from `/others/fridgeBeats/soundfonts/Roland_SC-55.sf2` when no user file is selected; SoundFont channels include independent bank dropdowns populated from `/others/fridgeBeats/soundfonts/`, and imported `.sf2` files are parsed client-side into preset/sample zones for playback, including a toolbar menu to set all SoundFont channels to a bundled bank or a custom upload
- `.frdgbeats` project files remain JSON and can embed imported sample files plus the active imported SoundFont bank as base64 assets for portable demos/projects
- imports `.mid`/`.midi` as full project replacements with 32-column patterns, SoundFont channels mapped from MIDI programs, pitch-bend slides converted to slide notes, and empty imported patterns disabled as playlist `0`; imports `.frdgbeats` project files into the full app state; project/MIDI imports show modal status with a percentage readout
- exports `.frdgbeats`, `.mid`, and rendered `.wav` files client-side with modal status and percentage readouts; WAV renders process each channel through its enabled mixer effect chain before encoding
- import/export actions are grouped into popover menus with short descriptions
- save/load uses browser localStorage and preserves embedded project assets plus bundled sample/SoundFont URLs where present

## Formatting / Examples / Errors

- `/formatting`
- `/formatting/example_page`
- `/error/403`
- `/error/404`
- `/error/50x`
- `/error/wip`
