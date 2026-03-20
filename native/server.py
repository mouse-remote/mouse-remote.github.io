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
#
# Cursor position is tracked locally rather than read back from the HID
# state, which may not update synchronously between events. Local tracking
# with explicit screen clamping guarantees the cursor reaches screen edges
# and corners, which is required for hot corners and Dock auto-hide.
_src   = None   # initialised in main()
_cur_x = 0.0
_cur_y = 0.0
_sw    = 0.0    # screen width
_sh    = 0.0    # screen height

def _post(event):
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, event)

def _click_pos():
    return Quartz.CGPoint(_cur_x, _cur_y)

def mouse_move(dx, dy):
    global _cur_x, _cur_y
    _cur_x = max(0, min(_sw, _cur_x + dx))
    _cur_y = max(0, min(_sh, _cur_y + dy))
    pt = Quartz.CGPoint(_cur_x, _cur_y)
    event = Quartz.CGEventCreateMouseEvent(_src, Quartz.kCGEventMouseMoved, pt, Quartz.kCGMouseButtonLeft)
    # Delta fields distinguish real movement from cursor warps; system UI
    # (hot corners, Dock) may ignore events where both deltas are zero.
    Quartz.CGEventSetIntegerValueField(event, Quartz.kCGMouseEventDeltaX, int(dx))
    Quartz.CGEventSetIntegerValueField(event, Quartz.kCGMouseEventDeltaY, int(dy))
    _post(event)

def mouse_click(right=False):
    pt = _click_pos()
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
    global _src, _cur_x, _cur_y, _sw, _sh
    _src = Quartz.CGEventSourceCreate(Quartz.kCGEventSourceStateHIDSystemState)

    bounds = Quartz.CGDisplayBounds(Quartz.CGMainDisplayID())
    _sw, _sh = bounds.size.width, bounds.size.height

    p = Quartz.CGEventGetLocation(Quartz.CGEventCreate(_src))
    _cur_x, _cur_y = p.x, p.y

    print(f"  python: {sys.executable}")

    import ctypes
    _ax = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices')
    _ax.AXIsProcessTrusted.restype = ctypes.c_bool
    trusted = _ax.AXIsProcessTrusted()
    print(f"  accessibility: {'OK' if trusted else 'NOT GRANTED — hot corners will not work'}")
    if not trusted:
        print(f"  fix: System Settings → Privacy & Security → Accessibility → + → {sys.executable}")

    print(f"  screen: {_sw:.0f}x{_sh:.0f}  cursor: ({_cur_x:.0f}, {_cur_y:.0f})")
    print(f"  mouse control: OK")
    print(f"\n  Mouse Remote server running on ws://localhost:{PORT}")
    print(f"  Keep this window open. Ctrl+C to stop.\n")
    # origins=None → accept connections from any origin (including chrome-extension://)
    async with websockets.serve(handle, "localhost", PORT, origins=None):
        await asyncio.Future()

try:
    asyncio.run(main())
except KeyboardInterrupt:
    print("\n  Stopped.")
