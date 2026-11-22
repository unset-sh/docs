#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ "$(node --version)" != "v26.12.0" ]]; then
  echo 'Use Node 26.12.0 from .nvmrc before building.' >&2
  exit 1
fi

mode="${1:-}"
if [[ $# -gt 1 || ( -n "$mode" && "$mode" != --preview && "$mode" != --publish ) ]]; then
  echo 'Usage: bash scripts/build.sh [--preview|--publish]' >&2
  exit 1
fi

config=hugo.yaml
output_args=(public)
if [[ "$mode" == --publish ]]; then
  # A valid source may be entirely draft/expired or disable its HTML rendering.
  # Verify the actual section landing pages after Hugo renders, too.
  section_names="$(node scripts/prepare.mjs --publish --json)"
  output_args+=(--require-sections "$section_names")
else
  node scripts/prepare.mjs
fi
node scripts/brand.mjs
if [[ "$mode" == --preview ]]; then
  node scripts/preview.mjs
  config=hugo.yaml,tests/fixtures/preview.yaml
fi

# The pinned image and flags match the existing docs build. --cleanDestinationDir
# also prevents a preceding fixture preview from leaving pages in a real build.
# https://gohugo.io/commands/hugo_build/
hugo_image=ghcr.io/gohugoio/hugo:v0.168.0@sha256:1fb8fe7f417abd5802d86747d297728aa48078d763159e7dff6559fe3f8bb8e7
base_url="${HUGO_BASEURL:-https://docs.unset.sh/}"
args=(build --gc --minify --panicOnWarning --cleanDestinationDir --config "$config" --baseURL "$base_url")
if [[ -n "${HUGO_BINARY:-}" ]]; then
  if [[ "$("$HUGO_BINARY" version)" != hugo\ v0.168.0* ]]; then
    echo 'HUGO_BINARY must be Hugo 0.168.0.' >&2
    exit 1
  fi
  "$HUGO_BINARY" "${args[@]}"
else
  docker run --rm --user "$(id -u):$(id -g)" \
    -e HOME=/tmp -e HUGO_CACHEDIR=/tmp/hugo_cache --entrypoint hugo \
    -v "$PWD:/project" -w /project "$hugo_image" "${args[@]}"
fi
python3 scripts/check-output.py "${output_args[@]}" --base-url "$base_url" --brand-dir .build/brand/static/_brand
