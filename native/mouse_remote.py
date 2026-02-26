#!/usr/bin/env python3
"""
Mouse Remote — native messaging host
Reads mouse events from the Chrome extension and dispatches them via pynput.

Requirements:  pip3 install pynput
macOS:         Grant Accessibility permission to Python in
               System Settings → Privacy & Security → Accessibility
"""

import sys
import json
import struct
import traceback

try:
    from pynput.mouse import Controller, Button
    mouse = Controller()
    READY = True
except ImportError:
    READY = False


def read_msg():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    length = struct.unpack('<I', raw)[0]
    return json.loads(sys.stdin.buffer.read(length))


def send_msg(obj):
    data = json.dumps(obj).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


if not READY:
    send_msg({'error': 'pynput not installed — run: pip3 install pynput'})
    while read_msg() is not None:
        pass
    sys.exit(1)

send_msg({'status': 'ready'})

# How many touch-delta pixels equal one scroll detent.
# Increase to scroll slower, decrease to scroll faster.
SCROLL_DIV = 60

while True:
    try:
        msg = read_msg()
        if msg is None:
            break

        e = msg.get('event', {})
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

    except Exception:
        send_msg({'error': traceback.format_exc()})
