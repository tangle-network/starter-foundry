#!/usr/bin/env bash
# Bevy-web build script. Trunk is the canonical path — this wrapper
# exists for CI systems that need a single reproducible entrypoint.
set -euo pipefail

# Prerequisites (install once per machine):
#   rustup target add wasm32-unknown-unknown
#   cargo install --locked trunk wasm-bindgen-cli

if ! command -v trunk >/dev/null 2>&1; then
  echo "error: trunk not found. Install with: cargo install --locked trunk" >&2
  exit 1
fi

MODE="${1:-release}"
case "$MODE" in
  dev)
    trunk build
    ;;
  release)
    trunk build --release
    ;;
  serve)
    exec trunk serve
    ;;
  *)
    echo "usage: $0 [dev|release|serve]" >&2
    exit 1
    ;;
esac

echo "bevy-web build done → dist/"
