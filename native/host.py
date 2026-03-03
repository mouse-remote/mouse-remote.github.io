#!/usr/bin/env python3
"""
Native messaging host for Mouse Remote.
Chrome calls this to launch server.py as a detached background process.
Communicates via stdin/stdout using the native messaging length-prefix protocol.
"""

import json
import os
import struct
import subprocess
import sys


def read_msg():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    length = struct.unpack('<I', raw)[0]
    return json.loads(sys.stdin.buffer.read(length).decode())


def send_msg(obj):
    data = json.dumps(obj).encode()
    sys.stdout.buffer.write(struct.pack('<I', len(data)) + data)
    sys.stdout.buffer.flush()


read_msg()  # consume the incoming message from the extension

here = os.path.dirname(os.path.abspath(__file__))
server = os.path.join(here, 'server.py')

try:
    subprocess.Popen(
        [sys.executable, server],
        start_new_session=True,  # detach from Chrome's process group
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    send_msg({'ok': True})
except Exception as e:
    send_msg({'ok': False, 'error': str(e)})
