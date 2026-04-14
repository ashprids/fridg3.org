#!/usr/bin/env bash

set -euo pipefail

if ! command -v php >/dev/null 2>&1; then
  echo "php is not installed or not available in PATH." >&2
  exit 1
fi

mapfile -d '' php_files < <(git ls-files -z '*.php')

if [ "${#php_files[@]}" -eq 0 ]; then
  echo "No tracked PHP files found."
  exit 0
fi

printf 'Linting %s PHP files\n' "${#php_files[@]}"

for file in "${php_files[@]}"; do
  php -l "$file"
done

echo "PHP lint passed."
