#!/usr/bin/env bash
HOST_NAME="io.mouseremote.native"
MANIFEST="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/$HOST_NAME.json"
rm -f "$MANIFEST"
echo "✓ Uninstalled"
