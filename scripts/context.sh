#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cat "$ROOT/docs/CONTEXT_BUNDLE.md"

echo ""
echo "---"
echo "Git Status:"
( cd "$ROOT" && git status --short )

echo ""
echo "---"
echo "Recent Commits:"
( cd "$ROOT" && git log --oneline -10 )
