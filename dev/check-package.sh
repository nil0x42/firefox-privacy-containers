#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root_dir=$(cd -- "$script_dir/.." && pwd)
cd "$root_dir"

version=$(sed -nE 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' manifest.json | head -n 1)
archive="dist/privacy-containers-${version}.xpi"

bash dev/package-addon.sh

contents=$(unzip -Z1 "$archive")
for required_path in manifest.json background/app.js domain/ui-state.js ui/icons.js options/app.html popup/popup.html blocked/blocked.html; do
  if ! grep -Fxq "$required_path" <<<"$contents"; then
    printf 'Package is missing %s\n' "$required_path" >&2
    exit 1
  fi
done

for icon_path in res/icon-48.png res/icon-96.png res/icon.png; do
  if ! grep -Fxq "$icon_path" <<<"$contents"; then
    printf 'Package is missing %s\n' "$icon_path" >&2
    exit 1
  fi
done

if grep -Eq '(^|/)(tests|dev|dist|node_modules|\.git|\.github)/|(^|/)(README|package(-lock)?\.json)$' <<<"$contents"; then
  printf 'Package contains development-only files:\n' >&2
  grep -E '(^|/)(tests|dev|dist|node_modules|\.git|\.github)/|(^|/)(README|package(-lock)?\.json)$' <<<"$contents" >&2
  exit 1
fi

printf 'Package contents verified: %s\n' "$archive"
