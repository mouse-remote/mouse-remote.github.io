#!/usr/bin/env bash
# Mouse Remote — native messaging host installer (macOS)
set -e

HOST_NAME="io.mouseremote.native"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

echo ""
echo "Mouse Remote — native host installer"
echo "────────────────────────────────────"
echo ""
echo "1. Open chrome://extensions in Chrome"
echo "2. Find 'Mouse Remote' and copy its ID (e.g. abcdefghijklmnop...)"
echo ""
printf "Paste extension ID: "
read -r EXT_ID

if [ -z "$EXT_ID" ]; then
  echo "No ID entered, aborting."
  exit 1
fi

# Check for pynput
if ! python3 -c "import pynput" 2>/dev/null; then
  echo ""
  echo "Installing pynput..."
  pip3 install pynput
fi

# Detect python3 path and write a wrapper so Chrome can find it
PYTHON3="$(which python3)"
WRAPPER="$SCRIPT_DIR/run.sh"

cat > "$WRAPPER" << SCRIPT
#!/usr/bin/env bash
exec "$PYTHON3" "\$(dirname "\$0")/mouse_remote.py"
SCRIPT
chmod +x "$WRAPPER"
chmod +x "$SCRIPT_DIR/mouse_remote.py"

# Write the native messaging manifest
mkdir -p "$MANIFEST_DIR"
cat > "$MANIFEST_DIR/$HOST_NAME.json" << JSON
{
  "name": "$HOST_NAME",
  "description": "Mouse Remote native host",
  "path": "$WRAPPER",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
JSON

echo ""
echo "✓ Installed!"
echo ""
echo "⚠️  macOS Accessibility permission required:"
echo "   System Settings → Privacy & Security → Accessibility"
echo "   Add Python: $PYTHON3"
echo ""
echo "Then reload the Mouse Remote extension — the popup will show 'System' mode."
