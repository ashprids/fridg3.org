# fridg3.org Developer Wiki

this wiki is the repo-shaped version of the project docs. it pulls from `README.md`, `TECHNICAL_REFERENCE_AI.md`, `TECHNICAL_REFERENCE_DEV.md`, and the codebase itself.

when docs and code disagree, trust the code.

## Start Here

- [Architecture](Architecture)
- [Routing and Rendering](Routing-and-Rendering)
- [Frontend and Templates](Frontend-and-Templates)
- [Routes and Features](Routes-and-Features)
- [API Reference](API-Reference)
- [Data Contracts](Data-Contracts)
- [Deployment and Operations](Deployment-and-Operations)
- [Development Workflow](Development-Workflow)

## Project Snapshot

`fridg3.org` is a PHP-first, file-backed personal site with a shared HTML shell, route-local content templates, and one big JavaScript layer for navigation and interactive features.

Core traits:

- most routes are directory-based and use `index.php` + `content.html`
- rendering is mostly server-side
- `template.html` is the default shell
- `template_mobile.html` is selected when mobile view is enabled
- `main.js` adds SPA-ish navigation, settings, bookmarks, toast bot UI, page views, and other client behaviors
- runtime content lives under `/data` and is intentionally excluded from deployment sync

## Source Of Truth

Useful files:

- `README.md`
- `TECHNICAL_REFERENCE_DEV.md`
- `TECHNICAL_REFERENCE_AI.md`
- `lib/render.php`
- `template.html`
- `template_mobile.html`
- `main.js`
- `style.css`
- `.github/workflows/*`
- `scripts/*`

## Stuff The Existing Docs Missed

The current technical references are solid, but a few real routes/features live in code and were not fully covered there:

- `account/admin/` and `account/admin/edit/`
- `discord/`
- `merch/`
- `others/fridge-builds-websites/`
- mobile template selection via `lib/render.php` and `template_mobile.html`
- deploy exclusions in `.rsyncignore`
- custom lint scripts in `/scripts`

## Practical Rule

If you need to change:

- one page layout: edit that route’s `content.html`
- one page’s server behavior: edit that route’s `index.php`
- shared UI: edit `template.html`, `template_mobile.html`, `style.css`, or `main.js`
- persistence or auth: edit the relevant PHP writer/reader and update the data contract
