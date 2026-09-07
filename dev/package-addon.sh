#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root_dir=$(cd -- "$script_dir/.." && pwd)
cd "$root_dir"

manifest='manifest.json'
current_version=$(sed -nE 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$manifest" | head -n 1)

if [[ -z "$current_version" ]]; then
  printf 'Could not find a version in %s\n' "$manifest" >&2
  exit 1
fi

if (( $# != 0 )); then
  printf 'Usage: %s\n' "$0" >&2
  printf 'The package version is read from manifest.json.\n' >&2
  exit 1
fi

stage_dir=$(mktemp -d)
trap 'rm -rf -- "$stage_dir"' EXIT

mkdir -p "$stage_dir"/{background,blocked,domain,options,popup,res,ui,utils}
cp manifest.json LICENSE "$stage_dir"/
cp background/*.js "$stage_dir/background/"
cp blocked/* "$stage_dir/blocked/"
cp domain/*.js "$stage_dir/domain/"
cp options/* "$stage_dir/options/"
cp popup/* "$stage_dir/popup/"
cp res/* "$stage_dir/res/"
cp ui/*.js "$stage_dir/ui/"
cp utils/*.js "$stage_dir/utils/"

mkdir -p dist
archive="privacy-containers-${current_version}.xpi"
web-ext build \
  --source-dir "$stage_dir" \
  --artifacts-dir dist \
  --filename "$archive" \
  --overwrite-dest

printf 'Created archive: dist/%s\n' "$archive"
