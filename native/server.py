#!/usr/bin/env python3
"""
Mouse Remote — local WebSocket server

Run this from Terminal to enable system-wide mouse control.
The Chrome extension auto-connects to ws://localhost:9999.

Requirements:
    pip3 install pyobjc-framework-Quartz websockets

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
    import Quartz
except ImportError:
    missing.append('pyobjc-framework-Quartz')

if missing:
    print(f"\n  Missing packages: {', '.join(missing)}")
    print(f"  Fix: pip3 install {' '.join(missing)}\n")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────

PORT = 9999
SCROLL_DIV = 60  # increase → slower scroll, decrease → faster scroll

# ── Mouse control ─────────────────────────────────────────────────────────
# kCGEventSourceStateHIDSystemState makes synthetic events look like real
# hardware input. NULL source marks events as synthetic and macOS system
# services (Dock auto-hide, hot corners, Mission Control) filter them out.
_src = None  # initialised in main() after Quartz is confirmed available

def _post(event):
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, event)

def _pos():
    p = Quartz.CGEventGetLocation(Quartz.CGEventCreate(_src))
    return p.x, p.y

def mouse_move(dx, dy):
    x, y = _pos()
    pt = Quartz.CGPoint(x + dx, y + dy)
    _post(Quartz.CGEventCreateMouseEvent(_src, Quartz.kCGEventMouseMoved, pt, Quartz.kCGMouseButtonLeft))

def mouse_click(right=False):
    x, y = _pos()
    pt = Quartz.CGPoint(x, y)
    if right:
        down, up, btn = Quartz.kCGEventRightMouseDown, Quartz.kCGEventRightMouseUp, Quartz.kCGMouseButtonRight
    else:
        down, up, btn = Quartz.kCGEventLeftMouseDown, Quartz.kCGEventLeftMouseUp, Quartz.kCGMouseButtonLeft
    _post(Quartz.CGEventCreateMouseEvent(_src, down, pt, btn))
    _post(Quartz.CGEventCreateMouseEvent(_src, up,   pt, btn))

def mouse_scroll(dx, dy):
    # kCGScrollEventUnitLine: positive = scroll up, negative = scroll down
    _post(Quartz.CGEventCreateScrollWheelEvent(
        _src, Quartz.kCGScrollEventUnitLine, 2,
        int(-dy / SCROLL_DIV),
        int( dx / SCROLL_DIV),
    ))

# ── Handler ───────────────────────────────────────────────────────────────

async def handle(ws):
    addr = ws.remote_address
    print(f"  ✓ Extension connected from {addr}")
    try:
        async for raw in ws:
            try:
                e = json.loads(raw)
                t = e.get('type')
                if   t == 'move':       mouse_move(e.get('dx', 0), e.get('dy', 0))
                elif t == 'click':      mouse_click()
                elif t == 'rightclick': mouse_click(right=True)
                elif t == 'scroll':     mouse_scroll(e.get('dx', 0), e.get('dy', 0))
            except Exception as ex:
                print(f"  ✗ Event error: {ex}")
    except Exception as ex:
        print(f"  ✗ Connection error: {ex}")
    print(f"  Extension disconnected")

# ── Main ──────────────────────────────────────────────────────────────────

async def main():
    global _src
    _src = Quartz.CGEventSourceCreate(Quartz.kCGEventSourceStateHIDSystemState)
    print(f"  python: {sys.executable}")
    trusted = Quartz.AXIsProcessTrusted()
    print(f"  accessibility: {'OK' if trusted else 'NOT GRANTED — hot corners will not work'}")
    if not trusted:
        print(f"  fix: System Settings → Privacy & Security → Accessibility → + → {sys.executable}")
    try:
        x, y = _pos()
        print(f"  mouse control: OK (position {x:.0f}, {y:.0f})")
    except Exception as e:
        print(f"  mouse control: FAILED — {e}")
    print(f"\n  Mouse Remote server running on ws://localhost:{PORT}")
    print(f"  Keep this window open. Ctrl+C to stop.\n")
    # origins=None → accept connections from any origin (including chrome-extension://)
    async with websockets.serve(handle, "localhost", PORT, origins=None):
        await asyncio.Future()

try:
    asyncio.run(main())
except KeyboardInterrupt:
    print("\n  Stopped.")
