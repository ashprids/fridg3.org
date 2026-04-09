# Development Environment Setup

this page is the practical "get the site running on your machine without doing wizard rituals" guide.

## Recommended Setup

example stack:

- VS Code
- PHP installed locally
- a VS Code extension that can serve PHP projects
- Git

good enough. no need to summon docker or kubernetes for a personal PHP site. that would be deeply unserious.

## 1. Clone The Repo

```bash
git clone https://github.com/ashprids/fridg3.org.git
cd fridg3.org
```

## 2. Install PHP

make sure PHP is installed and available in your terminal.

check it:

```bash
php -v
```

if that prints a version, you’re chilling.

this repo’s GitHub Actions lint job uses PHP `8.3`, so using PHP 8.3 locally is the safest move if you want fewer "works on my machine" plot twists.

## 3. Open The Repo In VS Code

open the project folder in VS Code:

```bash
code .
```

useful extensions:

- a PHP server extension
- a PHP syntax/intellisense extension
- optional: EditorConfig / GitHub Actions / ESLint-ish helpers if you like extra guard rails

for your example setup, a "serve project in php" style extension is perfect.

common options people use:

- `PHP Server`
- `PHP Preview`
- any extension that runs `php -S`

the important part is not the brand name. it just needs to serve the repo through PHP instead of opening the files raw.

## 4. Start A Local PHP Server

you can do this from an extension, or directly in the terminal.

manual version:

```bash
php -S localhost:8000
```

then open:

```text
http://localhost:8000
```

if your extension has a "Serve Project" button, that’s basically doing the same thing with less typing.

## 5. Create A Local `/data` Directory

this matters a lot.

the repo ignores `/data`, but the site expects it to exist. if you want more than static wrapper pages, you need local runtime data.

minimum useful structure:

```text
data/
  accounts/
    accounts.json
    login_attempts.json
  etc/
    wip
    page_views.json
```

you will probably also want:

```text
data/
  feed/
  journal/
  guestbook/
  images/
  music/
  audio/
  newsletter/
  downloads/
```

## 6. Minimal Starter Files

### `data/accounts/accounts.json`

```json
{
  "accounts": []
}
```

### `data/accounts/login_attempts.json`

```json
{}
```

### `data/etc/page_views.json`

```json
{
  "pages": {},
  "updated_at": null
}
```

### `data/etc/wip`

```text
false
```

## 7. Optional Local Admin Account

if you want to test account-only or admin-only pages, add an account manually.

example:

```json
{
  "accounts": [
    {
      "username": "dev",
      "name": "dev user",
      "password": "",
      "isAdmin": true,
      "allowedPages": ["feed", "journal"],
      "bookmarks": [],
      "glowIntensity": "medium",
      "mobileFriendlyView": false,
      "colors": {
        "bg": "#000000",
        "fg": "#EEEEEE",
        "border": "#3C7895",
        "subtle": "#917DAA",
        "links": "#415FAD"
      }
    }
  ]
}
```

using an empty password is convenient for local-only setup, but obviously don’t do that on a real public environment unless you enjoy chaos.

## 8. Things That Might Look Broken Locally

some features depend on data or services that may not exist in local dev:

- feed/journal content if your local `data` folders are empty
- newsletter archive if `data/newsletter` is empty
- music listings if `data/music` and `data/audio` are missing
- toast bot controls if `data/etc/toast.json` is missing
- off-topic archive if `data/etc/off-topic-archive.json` is missing
- deploy/backup workflows because those are GitHub Actions + server side

that does not mean the site is broken. it just means local dev has no content yet.

## 9. Useful Commands

lint PHP:

```bash
bash scripts/lint-php.sh
```

lint JavaScript:

```bash
bash scripts/lint-javascript.sh
```

lint CSS:

```bash
bash scripts/lint-css.sh
```

start local server manually:

```bash
php -S localhost:8000
```

## 10. Practical Workflow

pretty normal loop:

1. run the local PHP server
2. open the site in your browser
3. make edits in VS Code
4. refresh and test the affected route
5. run lint scripts before pushing

if you edit shared files like `template.html`, `template_mobile.html`, `main.js`, or `style.css`, test more than one page because shared code loves causing side-quest bugs.

## 11. If Something Is Acting Weird

quick checks before spiraling:

- does `php -v` work?
- are you serving through PHP, not just opening `index.php` as a file?
- does `/data` exist locally?
- are the required JSON files valid JSON?
- is `data/etc/wip` accidentally set to true?
- are you testing a page that depends on content you haven’t created yet?

## 12. Recommended Reality Check

for this project, the best dev setup is the one that gets you editing pages fast:

- VS Code
- local PHP
- simple PHP server extension
- local `/data` folder

that’s enough to build and test basically everything here without overengineering the life out of it.
