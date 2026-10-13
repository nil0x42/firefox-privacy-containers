#!/usr/bin/env bash
set -euo pipefail

output_file="$(mktemp)"
runner_pid=""

cleanup() {
  if [[ -n "$runner_pid" ]] && kill -0 "$runner_pid" 2>/dev/null; then
    kill "$runner_pid" 2>/dev/null || true
    wait "$runner_pid" 2>/dev/null || true
  fi
  rm -f "$output_file"
}
trap cleanup EXIT

firefox_binary="${FIREFOX_BINARY:-firefox}"
MOZ_WEBRENDER=0 ./node_modules/.bin/web-ext run \
  --firefox "$firefox_binary" \
  --no-input \
  --no-reload \
  --args=-headless >"$output_file" 2>&1 &
runner_pid=$!

for ((attempt = 0; attempt < 150; attempt += 1)); do
  if grep -q "Installed .* as a temporary add-on" "$output_file"; then
    sed -n '1,$p' "$output_file"
    exit 0
  fi

  if ! kill -0 "$runner_pid" 2>/dev/null; then
    status=0
    wait "$runner_pid" || status=$?
    sed -n '1,$p' "$output_file"
    exit "$status"
  fi

  sleep 0.1
done

sed -n '1,$p' "$output_file"
echo "Firefox did not load the extension within 15 seconds." >&2
exit 1
