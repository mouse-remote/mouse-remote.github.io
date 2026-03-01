#!/usr/bin/env python3
"""
Mouse Remote — local WebSocket server

Run this from Terminal to enable system-wide mouse control.
The Chrome extension auto-connects to ws://localhost:9999.

Requirements:
    pip3 install pynput websockets

macOS Accessibility (one-time):
    System Settings → Privacy & Security → Accessibility → add Terminal.app
"""

import asyncio
import json
import sys

# ── Dependency check ──────────────────────────────────────────────────────

missing = []
try:
    import websockets
except ImportError:
    missing.append('websockets')

try:
    from pynput.mouse import Controller, Button
    mouse = Controller()
except ImportError:
    missing.append('pynput')

if missing:
    print(f"\n  Missing packages: {', '.join(missing)}")
    print(f"  Fix: pip3 install {' '.join(missing)}\n")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────

PORT = 9999
SCROLL_DIV = 60  # increase → slower scroll, decrease → faster scroll

# ── Handler ───────────────────────────────────────────────────────────────

async def handle(ws):
    addr = ws.remote_address
    print(f"  ✓ Extension connected from {addr}")
    try:
        async for raw in ws:
            e = json.loads(raw)
            t = e.get('type')
            if t == 'move':
                mouse.move(e.get('dx', 0), e.get('dy', 0))
            elif t == 'click':
                mouse.click(Button.left)
            elif t == 'rightclick':
                mouse.click(Button.right)
            elif t == 'scroll':
                mouse.scroll(
                    e.get('dx', 0) / SCROLL_DIV,
                    -e.get('dy', 0) / SCROLL_DIV,
                )
    except Exception as ex:
        print(f"  ✗ Error: {ex}")
    print(f"  Extension disconnected")

# ── Main ──────────────────────────────────────────────────────────────────

async def main():
    print(f"\n  Mouse Remote server running on ws://localhost:{PORT}")
    print(f"  Keep this window open. Ctrl+C to stop.\n")
    # origins=None → accept connections from any origin (including chrome-extension://)
    async with websockets.serve(handle, "localhost", PORT, origins=None):
        await asyncio.Future()

try:
    asyncio.run(main())
except KeyboardInterrupt:
    print("\n  Stopped.")
