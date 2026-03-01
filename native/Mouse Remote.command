#!/usr/bin/env bash
# Double-click this file to start the Mouse Remote server.
# Add Terminal.app to Accessibility first:
#   System Settings → Privacy & Security → Accessibility → Terminal.app
cd "$(dirname "$0")"
python3 server.py
