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
log_path = os.path.join(os.path.expanduser('~'), 'Library', 'Logs', 'mouse-remote.log')

# Kill any stale server.py so the fresh launch always uses the latest code.
subprocess.run(['pkill', '-f', server], capture_output=True)
import time; time.sleep(0.4)  # allow port to free up

try:
    log = open(log_path, 'w')
    subprocess.Popen(
        [sys.executable, server],
        start_new_session=True,  # detach from Chrome's process group
        stdout=log,
        stderr=log,
    )
    send_msg({'ok': True})
except Exception as e:
    send_msg({'ok': False, 'error': str(e)})
