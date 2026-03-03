#!/usr/bin/env bash
# Mouse Remote — install dependencies and register native messaging host
set -e

echo ""
echo "Mouse Remote — system-wide mouse control setup"
echo "───────────────────────────────────────────────"

# ── Python dependencies ───────────────────────────────────────────────────

echo ""
echo "Installing Python dependencies..."
pip3 install pynput websockets

# ── Native messaging host ─────────────────────────────────────────────────

echo ""
echo "Registering native messaging host..."

HOST_PY="$(cd "$(dirname "$0")" && pwd)/host.py"
chmod +x "$HOST_PY"

# Extension ID — passed as $1 or prompted interactively
EXT_ID="${1:-}"
if [ -z "$EXT_ID" ]; then
  echo ""
  echo "  To find your extension ID:"
  echo "    1. Open Chrome → chrome://extensions"
  echo "    2. Enable 'Developer mode' (top right)"
  echo "    3. Find 'Mouse Remote' and copy the ID below the title"
  echo ""
  read -rp "  Extension ID: " EXT_ID
fi

MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/io.github.mouseremote.json" <<JSON
{
  "name": "io.github.mouseremote",
  "description": "Mouse Remote server launcher",
  "path": "$HOST_PY",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
JSON

echo ""
echo "✓ Done!"
echo ""
echo "The extension will now start the server automatically."
echo "You can still double-click 'Mouse Remote.command' to start it manually."
echo ""
echo "macOS Accessibility (one-time, if not already done):"
echo "  System Settings → Privacy & Security → Accessibility → add Terminal.app"
echo ""
