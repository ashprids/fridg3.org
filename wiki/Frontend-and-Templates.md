# Frontend and Templates

## Shared Templates

### `template.html`

desktop shell with:

- sidebar navigation
- footer buttons
- `{user_greeting}` placeholder
- `{content}` placeholder
- maintenance banner
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

translation: if you change shared ids, buttons, or route transitions, test more than one page or you will summon weird bugs.

## Styling

`style.css` defines:

- root color variables
- font-face declarations
- layout rules for shell and content
- reusable component styles
- mobile-template-specific overrides
- mini player, ASCII blocks, cards, grids, and assorted route UI

themes are declared by `/themes/*.json` and assets live in `/themes/lib`. desktop theme selection can use themed HTML and CSS; mobile view keeps the mobile template and appends theme CSS after mobile-specific inline styles.

fonts and icons come from:

- local font files in `resources/`
- Font Awesome CDN
- Highlight.js CDN

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
