#!/usr/bin/env bash
#
# Render /ref-doc to public/scout-room-ref-doc.pdf via headless Chrome.
#
# No npm deps. Uses the user's installed Chrome / Chromium. Boots a
# disposable next-dev server, captures the page, then tears down.
#
# Outputs:
#   public/scout-room-ref-doc.pdf
#
# Usage:
#   bash scripts/build_pdf.sh           # default port 3201
#   PORT=4000 bash scripts/build_pdf.sh

set -euo pipefail

PORT="${PORT:-3201}"
URL="http://localhost:${PORT}/ref-doc"
OUT="public/scout-room-ref-doc.pdf"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Resolve a Chrome / Chromium binary across common locations.
find_chrome() {
  local candidates=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    "$(command -v google-chrome 2>/dev/null || true)"
    "$(command -v chromium 2>/dev/null || true)"
    "$(command -v chromium-browser 2>/dev/null || true)"
  )
  for c in "${candidates[@]}"; do
    [ -n "$c" ] && [ -x "$c" ] && { echo "$c"; return 0; }
  done
  return 1
}

CHROME="$(find_chrome)" || {
  echo "build_pdf.sh: no Chrome / Chromium found. Install Chrome or set" >&2
  echo "  CHROME=/path/to/chrome bash scripts/build_pdf.sh" >&2
  exit 1
}

mkdir -p public

echo "build_pdf.sh: starting next dev on :$PORT"
# Note: PORT env not honored by next dev; we pass -p explicitly.
npm run --silent dev -- -p "$PORT" >/tmp/scout-pdf-dev.log 2>&1 &
DEV_PID=$!
trap 'kill "$DEV_PID" 2>/dev/null || true' EXIT

# Wait for the server to be ready (max ~30s).
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "$URL"; then break; fi
  sleep 0.5
done

if ! curl -sf -o /dev/null "$URL"; then
  echo "build_pdf.sh: dev server didn't come up. Tail of log:" >&2
  tail -30 /tmp/scout-pdf-dev.log >&2 || true
  exit 1
fi

echo "build_pdf.sh: capturing $URL"
TMP_PROFILE="$(mktemp -d)"
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --hide-scrollbars \
  --user-data-dir="$TMP_PROFILE" \
  --virtual-time-budget=5000 \
  --print-to-pdf-no-header \
  --no-pdf-header-footer \
  --print-to-pdf="$REPO_ROOT/$OUT" \
  "$URL"
rm -rf "$TMP_PROFILE"

echo "build_pdf.sh: wrote $OUT"
ls -lh "$OUT"
