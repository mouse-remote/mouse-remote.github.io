#!/usr/bin/env bash
PLIST="$HOME/Library/LaunchAgents/io.github.mouseremote.server.plist"
if [ -f "$PLIST" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm "$PLIST"
  echo "✓ Removed LaunchAgent"
else
  echo "Nothing to remove"
fi
