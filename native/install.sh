#!/usr/bin/env bash
# Mouse Remote — install dependencies
set -e

echo ""
echo "Mouse Remote — system-wide mouse control setup"
echo "───────────────────────────────────────────────"

# Install Python deps
echo ""
echo "Installing Python dependencies..."
pip3 install pynput websockets

echo ""
echo "✓ Done!"
echo ""
echo "To enable system-wide control:"
echo ""
echo "  1. Add Terminal.app to Accessibility:"
echo "     System Settings → Privacy & Security → Accessibility"
echo "     Click + → /Applications/Utilities/Terminal.app"
echo ""
echo "  2. Start the server (keep the window open):"
echo "     python3 server.py"
echo "     — or double-click 'Mouse Remote.command'"
echo ""
echo "The extension popup badge will switch to 'System' when connected."
