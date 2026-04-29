# Theme Creation Instructions

this directory contains selectable website themes for fridg3.org.

if a user says something like "using this AGENTS.md, create an x based theme", you should be able to make the whole theme from this file plus the existing examples. do the work directly unless the request is dangerously unclear.

## Mental Model

a theme has two parts:

- metadata json in `/themes`
- assets in `/themes/lib`

the metadata file is what makes the theme appear in `/settings`. the filename, minus `.json`, becomes the saved theme id.

example:

```json
{
  "name": "Frutiger Aero",
  "html": "frutiger-aero-template.html",
  "css": "frutiger-aero.css"
}
```

this means:

- settings label: `Frutiger Aero`
- saved id: `example_theme` if the file is `/themes/example_theme.json`
- desktop template: `/themes/lib/frutiger-aero/frutiger-aero-template.html`
- theme stylesheet: `/themes/lib/frutiger-aero/frutiger-aero.css`

## Files To Create

for a new theme, create:

- `/themes/{theme-id}.json`
- `/themes/lib/{theme-id}/{theme-id-or-theme-name}.html`
- `/themes/lib/{theme-id}/{theme-id-or-theme-name}.css`

keep ids lowercase with `a-z`, `0-9`, `_`, and `-`. avoid spaces in filenames.

## Required JSON Rules

theme json must be valid JSON and must include:

- `name`: human-readable label shown in `/settings`
- `html`: relative path inside `/themes/lib`
- `css`: relative path inside `/themes/lib`

do not put paths like `/themes/lib/foo.css` in the json. use paths relative to `/themes/lib`, such as `aero/aero.css`.

allowed asset path characters are letters, numbers, `.`, `_`, `-`, and `/`. never use `..`, absolute paths, empty path segments, or weird shell-ish filenames.

## Template Requirements

start from `/template.html` unless the user asks for a radical layout. copy it into `/themes/lib/{theme-id}`, then adapt it.

the template must preserve these placeholders:

- `{title}`
- `{description}`
- `{content}`
- `{user_greeting}`

the template should preserve these scripts/styles unless there is a very good reason:

- Font Awesome CDN link
- Highlight.js CDN CSS and JS
- `/main.js`
- favicon and manifest links

the template should include a stylesheet link to `/style.css`; the renderer appends the selected theme CSS later, so the theme CSS can override base styling.

## Layout Freedom

themes are allowed to change the website layout. this is not just a color-skin system.

you may:

- move the menu
- redesign the sidebar
- make the layout top-nav, bottom-nav, split-panel, dashboard-like, etc.
- add decorative wrappers or background elements
- change spacing, borders, visual density, typography, and component shape

but you must keep:

- a visible content display area containing `{content}`
- a usable menu/navigation of some sort
- account/settings/home navigation available somewhere
- the mini-player markup unless the theme intentionally restyles it
- IDs/classes that `main.js` depends on, unless you also verify and update the JS safely

translation: go wild aesthetically, but do not strand users on a pretty page with no content or nav. that would be deeply goofy.

## Mobile Behavior

mobile view uses `/template_mobile.html`, not the theme HTML file.

when mobile-friendly view is active:

- only the theme CSS is applied
- the theme HTML is ignored
- write mobile overrides under `body.mobile-template`

this means every theme CSS should include mobile-specific polish if the theme changes core layout, backgrounds, nav buttons, content spacing, cards, or forms.

important mobile selectors that often need theme overrides:

- `body.mobile-template`
- `body.mobile-template #sidebar`
- `body.mobile-template .mobile-collapsed-header`
- `body.mobile-template #show-sidebar`
- `body.mobile-template .mobile-nav-grid`
- `body.mobile-template .mobile-nav-button`
- `body.mobile-template #footer-buttons`
- `body.mobile-template .mobile-footer-button`
- `body.mobile-template #content`
- `body.mobile-template #content-layout`
- `body.mobile-template #content-main`
- `body.mobile-template #mini-player`

mobile CSS may need `!important` because `template_mobile.html` has inline mobile-specific styles. use it where necessary, not everywhere like a maniac.

## CSS Strategy

theme CSS is appended after the base stylesheet. normally do not `@import url('/style.css')` in theme CSS, because that can reload base styles after mobile styles and break mobile theming.

set the core color variables early:

```css
:root {
    --bg: #000000;
    --fg: #eeeeee;
    --border: #3c7895;
    --subtle: #917daa;
    --links: #415fad;
}
```

then override components directly.

common components:

- `body`
- `#page-wrapper`
- `#sidebar`
- `#header`
- `#title`
- `#tab`
- `#container`
- `#content`
- `#content-layout`
- `#content-main`
- `#post`
- `#search`
- `#search-box`
- `#search-button`
- `#footer-buttons`
- `#footer-button`
- `#mini-player`
- form inputs, buttons, `.dropdown`, `.radio`, `.checkbox`

## Content Spacing

be careful with padding on `#content-main`: it reduces usable width for page content. if the user asks for more breathing room without shrinking content, prefer outer margins, pseudo-elements, or background wrappers.

good pattern:

```css
#content-layout {
    position: relative;
    isolation: isolate;
}

#content-layout::before {
    content: "";
    position: absolute;
    inset: -20px;
    z-index: -1;
    pointer-events: none;
}
```

this makes the visual panel larger without stealing content width.

## Accessibility And Usability

keep themes readable:

- preserve strong text/background contrast
- make links visually distinct
- make focus/hover states visible
- keep buttons and controls large enough to click
- avoid hiding overflow in ways that cut off content
- check long words, ASCII art, forms, and post cards

if a theme uses very decorative backgrounds, make content panels opaque enough to read.

## Validation

after creating or changing a theme:

1. validate json:

```bash
php -r 'json_decode(file_get_contents("themes/{theme-id}.json"), true); echo json_last_error_msg(), "\n";'
```

2. check the theme loader sees it:

```bash
php -r 'require "lib/render.php"; echo json_encode(array_values(array_map(fn($t)=>["id"=>$t["id"],"name"=>$t["name"]], fridg3_list_themes(__DIR__))), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";'
```

3. check whitespace:

```bash
git diff --check -- themes/{theme-id}.json themes/lib/{theme-id}/{theme}.html themes/lib/{theme-id}/{theme}.css
```

4. if PHP render helper changed, run:

```bash
php -l lib/render.php
```

do not start a dev server for this repo. assume one is already running if preview is needed.

## Documentation

if you change how themes work, update the wiki. if you only add a normal theme, wiki changes usually are not needed.
