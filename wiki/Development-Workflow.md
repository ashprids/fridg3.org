# Development Workflow

## Where To Edit

- change one page’s layout or copy: route `content.html`
- change one page’s server logic: route `index.php`
- change shared shell: `template.html` and probably `template_mobile.html`
- change shared interaction logic: `main.js`
- change shared look: `style.css`
- change persistence or permissions: relevant PHP code plus data contract

## Safe Change Flow

1. decide whether the change is content, route logic, shared shell, frontend behavior, or persistence
2. edit the smallest correct surface
3. if data shape changes, update read path, write path, and defaults
4. if auth/admin behavior changes, enforce it in PHP, not just JS
5. test the target page and at least one unrelated page that shares the shell

## Linting

GitHub Actions runs three lint steps:

- `bash scripts/lint-php.sh`
- `bash scripts/lint-javascript.sh`
- `bash scripts/lint-css.sh`

custom linting details:

- PHP uses `php -l`
- JavaScript uses `node --check`
- inline JS in `.html` and `.php` files is syntax-checked too
- CSS uses custom Node scripts that validate standalone CSS, inline `<style>`, and `style=""` attributes

this setup is simple but honestly pretty smart for a repo with lots of inline markup/script/style.

## Gotchas

- login/logout footer swap depends on exact HTML strings
- `main.js` is large and route-sensitive
- feed and journal have different storage models
- bookmarks have both server and localStorage behavior
- some old code still references legacy bookmark storage patterns
- mobile view is both a cookie and an account setting

## Broad Refactors Checklist

before making a sweeping change, review:

- root files: `index.php`, `content.html`, `template.html`, `template_mobile.html`, `main.js`, `style.css`
- affected route directory
- related API endpoint
- `lib/render.php`
- relevant workflow or script if the change affects deploy/lint/runtime ops

## Practical Advice

- trust code over docs when they conflict
- prefer boring safe edits over galaxy-brain rewrites
- if you touch shared DOM ids or route transitions, click around the site after
- if you touch `/data` schema, document it immediately so future-you doesn’t get jump-scared
