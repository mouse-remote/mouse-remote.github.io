#!/usr/bin/env bash
# Mouse Remote — install dependencies and register LaunchAgent
set -e

echo ""
echo "Mouse Remote — system-wide mouse control setup"
echo "───────────────────────────────────────────────"

# ── Python dependencies ───────────────────────────────────────────────────

echo ""
echo "Installing Python dependencies..."
pip3 install pynput websockets

# ── LaunchAgent (auto-starts server on login) ─────────────────────────────

echo ""
echo "Installing LaunchAgent..."

SERVER_PY="$(cd "$(dirname "$0")" && pwd)/server.py"
PYTHON3="$(which python3)"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/io.github.mouseremote.server.plist"
LOG_PATH="$HOME/Library/Logs/mouse-remote.log"

mkdir -p "$PLIST_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>io.github.mouseremote.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON3</string>
    <string>-u</string>
    <string>$SERVER_PY</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_PATH</string>
  <key>StandardErrorPath</key>
  <string>$LOG_PATH</string>
</dict>
</plist>
PLIST

# Reload to pick up any path changes
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo ""
echo "✓ Done! Server is running on ws://localhost:9999"
echo "  Logs: $LOG_PATH"
echo ""
echo "macOS Accessibility (one-time, if not already done):"
echo "  System Settings → Privacy & Security → Accessibility → add Terminal.app"
echo ""
