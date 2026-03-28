#!/usr/bin/env bash

set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "node is not installed or not available in PATH." >&2
  exit 1
fi

mapfile -d '' js_files < <(git ls-files -z '*.js')
mapfile -d '' html_files < <(git ls-files -z '*.html')
mapfile -d '' php_files < <(git ls-files -z '*.php')

if [ "${#js_files[@]}" -eq 0 ] && [ "${#html_files[@]}" -eq 0 ] && [ "${#php_files[@]}" -eq 0 ]; then
  echo "No tracked JavaScript, HTML, or PHP files found."
  exit 0
fi

if [ "${#js_files[@]}" -gt 0 ]; then
  printf 'Linting %s JavaScript files\n' "${#js_files[@]}"
  for file in "${js_files[@]}"; do
    node --check "$file"
  done
fi

if [ "${#html_files[@]}" -gt 0 ]; then
  printf 'Linting JavaScript embedded in %s HTML files\n' "${#html_files[@]}"
  node scripts/lint-html-javascript.mjs "${html_files[@]}"
fi

if [ "${#php_files[@]}" -gt 0 ]; then
  printf 'Linting JavaScript embedded in %s PHP files\n' "${#php_files[@]}"
  node scripts/lint-html-javascript.mjs "${php_files[@]}"
fi

echo "JavaScript lint passed."
