#!/usr/bin/env bash
# Gen-3 measurement-freshness pre-push hook.
#
# Stops a push when .evolve/ analysis files are stale relative to
# .evolve/traces/buildouts.jsonl. Forces the operator to run
# `pnpm measure:refresh` and commit the regen first.
#
# Bypass for genuine emergencies: `git push --no-verify`.
# Disable permanently for a clone: `git config hook.skip-measure-check true`.

set -euo pipefail

# Allow explicit opt-out (for machines where the pipeline can't run — e.g.
# CI-in-a-fork, air-gapped machines, or when hot-fixing a branch that
# doesn't touch measurement state).
if [ "$(git config --get hook.skip-measure-check 2>/dev/null || echo false)" = "true" ]; then
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# If there's no traces source, nothing to check — normal for fresh clones.
if [ ! -f ".evolve/traces/buildouts.jsonl" ]; then
  exit 0
fi

# Dry-run the orchestrator: exits 0 if clean, 2 if drift detected.
if ! command -v node >/dev/null 2>&1; then
  echo "pre-push: node not found on PATH; skipping measurement check" >&2
  exit 0
fi

# Capture exit code explicitly — `if ! cmd; then ...; $?` reports the status
# of `!` (inverted), not `cmd`. Run the check, then branch on the real status.
set +e
node scripts/measure-refresh.mjs --dry-run --quiet >/dev/null 2>&1
STATUS=$?
set -e

case "$STATUS" in
  0)
    # Clean — nothing to do.
    exit 0
    ;;
  2)
    # Drift detected. Surface the specifics and the one-line fix.
    echo ""
    echo "━━━━ pre-push: measurement drift detected ━━━━"
    node scripts/measure-refresh.mjs --dry-run 2>&1 | grep -E '^  -' || true
    echo ""
    echo "Before pushing, regenerate the stale measurements:"
    echo "  pnpm measure:refresh && git add .evolve/ && git commit -m 'chore: refresh measurements'"
    echo ""
    echo "Or bypass (only for hotfixes that don't touch measurement):"
    echo "  git push --no-verify"
    echo ""
    exit 1
    ;;
  *)
    # Non-drift failure (e.g. script error) — warn, don't block.
    echo "pre-push: measure-refresh check failed unexpectedly (exit $STATUS); continuing" >&2
    exit 0
    ;;
esac
