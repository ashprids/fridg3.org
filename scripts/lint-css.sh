#!/usr/bin/env bash

set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "node is not installed or not available in PATH." >&2
  exit 1
fi

mapfile -d '' css_files < <(git ls-files -z '*.css')
mapfile -d '' html_files < <(git ls-files -z '*.html')
mapfile -d '' php_files < <(git ls-files -z '*.php')

if [ "${#css_files[@]}" -eq 0 ] && [ "${#html_files[@]}" -eq 0 ] && [ "${#php_files[@]}" -eq 0 ]; then
  echo "No tracked CSS, HTML, or PHP files found."
  exit 0
fi

if [ "${#css_files[@]}" -gt 0 ]; then
  printf 'Linting %s CSS files\n' "${#css_files[@]}"
  node scripts/lint-css-files.mjs "${css_files[@]}"
fi

if [ "${#html_files[@]}" -gt 0 ]; then
  printf 'Linting CSS embedded in %s HTML files\n' "${#html_files[@]}"
  node scripts/lint-html-css.mjs "${html_files[@]}"
fi

if [ "${#php_files[@]}" -gt 0 ]; then
  printf 'Linting CSS embedded in %s PHP files\n' "${#php_files[@]}"
  node scripts/lint-html-css.mjs "${php_files[@]}"
fi

echo "CSS lint passed."
