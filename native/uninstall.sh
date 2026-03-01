#!/usr/bin/env bash
# Removes the old native messaging manifest if previously installed.
MANIFEST="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/io.mouseremote.native.json"
if [ -f "$MANIFEST" ]; then
  rm "$MANIFEST"
  echo "✓ Removed old native messaging manifest"
else
  echo "Nothing to remove"
fi
