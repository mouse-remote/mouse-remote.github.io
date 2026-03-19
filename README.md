# mouse-remote

Control your Mac's mouse with your phone via WebRTC P2P.

```
Phone (touchpad) ──WebRTC──> Chrome Extension ──WebSocket──> server.py ──pynput──> OS
```

No relay server — signaling via PeerJS cloud, then direct P2P.

## Setup

### 1. Load the extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder

### 2. Install the native server

```bash
cd native
./install.sh
```

This installs a macOS LaunchAgent that runs `server.py` on login (auto-restarts if it crashes). Requires Python 3 with `pynput` and `websockets`.

**One-time macOS permission:** System Settings → Privacy & Security → Accessibility → add Terminal.app (or whatever runs `python3`).

### 3. Connect

1. Click the Mouse Remote extension icon
2. Sign in with GitHub for auto-connect — or copy the peer ID and paste it into the phone
3. Open the phone page on your phone and it connects automatically
4. Use your phone as a trackpad

## Gestures

| Gesture | Action |
|---|---|
| 1-finger drag | Move mouse |
| Tap | Left click |
| 2-finger tap | Right click |
| 2-finger drag | Scroll |
| Scroll button (action bar) | Toggle scroll mode |
| Left / Right Click buttons | Explicit clicks |

## Files

```
extension/          Chrome extension (load unpacked)
  manifest.json
  background.js     Service worker: auth + offscreen lifecycle
  offscreen.html/js Persistent WebRTC peer + WS client
  popup.html/js     Status UI + phone link
  content.js        Bridges GitHub auth from phone page to extension
  peerjs.min.js     Bundled PeerJS (no CDN in extensions)

phone/
  index.html        Touchpad UI — deploy to GitHub Pages
  index.js          Touchpad logic + connection handling
  auth.js           GitHub OAuth + peer ID derivation
  signin.html       Desktop sign-in page (opened by extension)

native/
  server.py         WebSocket server → pynput mouse control
  install.sh        Installs LaunchAgent + Python deps
```

## Notes

- Logs at `~/Library/Logs/mouse-remote.log`
- To uninstall the server: `launchctl unload ~/Library/LaunchAgents/io.github.mouseremote.server.plist`
- PeerJS free cloud signaling (`0.peerjs.com`) — for private use, self-host: https://github.com/peers/peerjs-server
