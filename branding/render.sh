#!/usr/bin/env bash
# Renders the social share image and app icons into src/Bhasini.Web/wwwroot.
# Needs Microsoft Edge or Google Chrome (headless) and network access for Google Fonts.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
out="$here/../src/Bhasini.Web/wwwroot"

browser="${BROWSER_BIN:-}"
for candidate in \
    "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
    "/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "$(command -v google-chrome || true)" \
    "$(command -v chromium || true)"; do
  if [ -z "$browser" ] && [ -n "$candidate" ] && [ -x "$candidate" ]; then browser="$candidate"; fi
done
[ -n "$browser" ] || { echo "No Edge/Chrome found; set BROWSER_BIN" >&2; exit 1; }

to_url() {
  if command -v cygpath >/dev/null; then echo "file:///$(cygpath -m "$1")"; else echo "file://$1"; fi
}
to_path() {
  if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi
}

shot() { # html width height output
  "$browser" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --virtual-time-budget=8000 \
    --window-size="$2,$3" --screenshot="$(to_path "$4")" "$(to_url "$1")" >/dev/null 2>&1
}

tmp="$(mktemp -d)"
shot "$here/og-image.html" 1200 630 "$tmp/og.png"
# Headless browsers enforce a minimum window width, so icons are rendered once at 512px and downscaled.
shot "$here/icon.html" 512 512 "$tmp/icon.png"

# The browser can return before the file is flushed.
for f in "$tmp/og.png" "$tmp/icon.png"; do
  for _ in $(seq 1 50); do [ -s "$f" ] && break; sleep 0.2; done
done

# JPEG keeps the share image well under WhatsApp's ~300 KB preview limit.
python - "$tmp" "$out" <<'PY'
import sys
from PIL import Image
tmp, out = sys.argv[1], sys.argv[2]
Image.open(f"{tmp}/og.png").convert("RGB").save(f"{out}/og-image.jpg", quality=86, optimize=True, progressive=True)
icon = Image.open(f"{tmp}/icon.png").convert("RGB")
for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")]:
    icon.resize((size, size), Image.LANCZOS).save(f"{out}/{name}", optimize=True)
    print("wrote", name)
print("wrote og-image.jpg")
PY
rm -rf "$tmp"
