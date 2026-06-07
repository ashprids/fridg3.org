# Frontend and Templates

## Shared Templates

### `template.html`

desktop shell with:

- sidebar navigation
- footer buttons
- `{user_greeting}` placeholder
- `{content}` placeholder
- maintenance banner
- local dev-mode banner injected by `lib/render.php`
- mini player markup
- page view footer

### `template_mobile.html`

mobile shell with:

- responsive header/nav grid
- adjusted sidebar/content layout
- shared placeholders from the desktop shell
- explicit stylesheet cache-busting query string on `/style.css`

this is not just a tiny CSS tweak. it is a separate HTML shell, so shared structural edits usually need to be mirrored in both templates.

## Global Frontend Script

`main.js` is the site-wide behavior blob. it handles a lot:

- maintenance/WIP enforcement
- dev-mode display is server-rendered when the host looks local
- SPA-ish navigation and route transitions
- page view footer updates
- settings load/save
- mobile-view preference syncing
- bookmark toggles
- mini player
- toast discord bot UI helpers
- off-topic archive rendering
- ASCII time / usage widgets
- route-specific enhancements
- BBCode mention highlighting for feed-style content
- on-site popup notices, confirmations, and text prompts

translation: if you change shared ids, buttons, or route transitions, test more than one page or you will summon weird bugs.

the mini player is shared chrome. `/music` album cards should open the site popup track picker and send the chosen song into the mini player; do not rebuild album track lists inside the sidebar player.

## Popups And External Links

use the on-site popup helpers in `main.js`, not native browser `alert()`, `confirm()`, or `prompt()`.

- notices: `showSiteNotice(title, detail)`
- confirmations: `showSitePopup({ title, detail/html, okText, cancelText })`
- text input: `showSitePrompt(title, detail, value)`
- form confirmations: add `data-site-confirm="1"` plus `data-confirm-*` text attributes
- account deletion can use `data-delete-animation="account-rip"`; other destructive forms should use plain in-site confirmations

all clicked `http(s)` links that leave `fridg3.org`, `www.fridg3.org`, or `m.fridg3.org` automatically show a safety popup before navigation. use `data-no-external-popup` only for a deliberately exempt link, and document why because bypassing safety popups is usually sus.

## Styling

`style.css` defines:

- root color variables
- font-face declarations
- layout rules for shell and content
- reusable component styles
- mobile-template-specific overrides
- mini player, ASCII blocks, cards, grids, and assorted route UI

blackprint is the base/default theme in `/style.css` and `template.html`. its default-only CSS is scoped to `body.blackprint-theme`; keep it scoped so selectable themes are not forced to override blackprint details just to look normal. blackprint uses a dark charcoal grey base, and its sidebar `fridg3.org` title intentionally keeps the purple-to-cyan clipped text gradient. selectable themes are declared by `/themes/*.json` and assets live in `/themes/lib`; `classic` is the old default look and is the only settings theme that exposes color picker overrides. desktop theme selection can use themed HTML and CSS; mobile view keeps the mobile template and appends theme CSS after mobile-specific inline styles. default mobile rendering receives `blackprint-theme` from `lib/render.php`.

the sidebar show/hide control is animated through `body.sidebar-is-hidden`, which `main.js` toggles while preserving the `sidebarVisible` localStorage preference. blackprint and whiteprint keep their desktop `>>` menu prefixes, but mobile nav buttons suppress those prefixes for a cleaner grid.

the homepage FRIDG3.ORG ASCII hero uses the shared `--hero-ascii-*` color variables so each theme can tune the gradient without editing homepage markup. the server-time and resource ASCII use `--time-*` and `--resource-*` variables, which default to the hero palette unless a theme overrides them. resource cards are intentionally unboxed so the ASCII itself carries the theme.

frdgBeats is theme-aware. its base stylesheet keeps the original default DAW colors, while selected theme stylesheets override `.frdgbeats-daw` `--fdgb-*` variables derived from `--bg`, `--fg`, `--border`, `--subtle`, and `--links`. body-mounted popups copy those variables from the app wrapper so their dialogs stay opaque and themed. synth and effect custom editors keep their own unique styling across every theme. the frdgBeats route also forces the app content area to full width after theme CSS loads.

fonts and icons come from:

- local font files in `resources/`
- Twemoji COLR from jsDelivr as the global emoji font fallback
- Font Awesome CDN
- Highlight.js CDN

## Formatting Lab

`/formatting` is the shared UI specimen page. it loads normal page chrome, theme CSS, route-local `content.html`, and small examples of reusable elements used around the site: typography, links, buttons, forms, status blocks, popups, tooltips, cards, grids, pagination, dashboard cards, and BBCode editor pieces.

when a reusable element or shared interaction is added, changed, or restyled, add a representative sample to `formatting/content.html` too. skip route-specific systems that realistically will never appear elsewhere, like frdgBeats internals, because those should stay documented and tested with their own page.

## Frontend State

local/browser state used by the site includes:

- `mobile_friendly_view` cookie
- `theme_pref` cookie
- `is_admin` cookie
- localStorage bookmarks for anonymous users
- localStorage dismissal state for some prompts

server-backed user state is exposed through:

- `/api/settings`
- `/api/themes`
- `/api/bookmark`
- session-based auth

## Fragile Bits

- account/logout button swapping relies on exact HTML string matching in many routes
- some routes and helpers do not use the exact same logout icon markup, so template edits there deserve extra care
- `main.js` is route-sensitive and very DOM-id-sensitive
- bookmark UI exists in both server and client paths
- `/bookmarks` also rehydrates anonymous saves client-side, so shared bookmark helpers in `main.js` are exposed on `window`

## Rule Of Thumb

edit:

- `content.html` for page-specific markup
- route `index.php` for server-side data flow
- `template.html` and `template_mobile.html` for shared shell changes
- `main.js` for client interaction changes
- `style.css` for shared styling
