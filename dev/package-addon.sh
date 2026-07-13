#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root_dir=$(git -C "$script_dir" rev-parse --show-toplevel)
cd "$root_dir"

manifest='manifest.json'
current_version=$(sed -nE 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$manifest" | head -n 1)

if [[ -z "$current_version" ]]; then
  printf 'Could not find a version in %s\n' "$manifest" >&2
  exit 1
fi

suggested_version=${1:-$current_version}
printf 'Usage: %s [suggested-version]\n' "$0"
printf 'Example: %s 0.1.1\n\n' "$0"
printf 'Current version: %s\n' "$current_version"
read -r -p "New version [$suggested_version] (press Enter to keep the suggestion): " version
version=${version:-$suggested_version}

if [[ ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  printf 'Invalid version: %s (expected: MAJOR.MINOR.PATCH)\n' "$version" >&2
  exit 1
fi

if [[ "$version" != "$current_version" ]]; then
  sed -i -E "0,/^([[:space:]]*\"version\"[[:space:]]*:[[:space:]]*)\"[^\"]+\"/s//\1\"$version\"/" "$manifest"
  printf 'Updated version: %s -> %s\n' "$current_version" "$version"
fi

mkdir -p dist
archive="dist/privacy-containers-${version}.xpi"
rm -f "$archive"

# Package only files that Firefox loads at runtime. Development files such as
# tests, documentation, this script, package metadata, and dist/ are kept out
# of the XPI so the submitted artifact is small and straightforward to review.
package_paths=(
  manifest.json
  LICENSE
  background/*.js
  blocked/*
  options/*
  popup/*
  res/*
  utils/*.js
)

zip -r "$archive" "${package_paths[@]}" \
  -x '*/.*' '.*' >/dev/null

printf 'Created archive: %s\n' "$archive"
