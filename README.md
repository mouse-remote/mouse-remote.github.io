# mouse-remote

Control your browser's mouse with your phone via WebRTC P2P.

```
Phone (touchpad) ──WebRTC──> Chrome Extension ──chrome.debugger──> Active Tab
```

No server required — signaling via PeerJS cloud, then direct P2P.

## Setup

### 1. Load the extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder

### 2. Deploy phone page to GitHub Pages

1. Push this repo to GitHub
2. Go to repo **Settings → Pages → Source: `main` branch, `/` (root)**
3. Update the `PHONE_BASE_URL` constant in `extension/popup.js`:
   ```js
   const PHONE_BASE_URL = 'https://YOUR_USERNAME.github.io/mouse-remote/phone/';
   ```
4. Reload the extension

### 3. Connect

1. Click the Mouse Remote extension icon
2. Copy the phone link shown in the popup (or click "Open on Phone")
3. Open the link on your phone — it auto-connects
4. Use your phone as a trackpad!

## Gestures

| Gesture | Action |
|---|---|
| 1-finger drag | Move mouse |
| Tap | Left click |
| 2-finger tap | Right click |
| 2-finger drag | Scroll |
| Scroll button (action bar) | Toggle scroll mode |
| Left Click button | Left click |
| Right Click button | Right click |

## Notes

- The extension uses `chrome.debugger` to dispatch mouse events — Chrome will show a banner saying "DevTools opened". This is normal for debugger-based extensions.
- The PeerJS free cloud signaling server (`0.peerjs.com`) is used. For private use, you can self-host: https://github.com/peers/peerjs-server
- Only controls input within the browser tab, not the OS mouse.

## Files

```
extension/          Chrome extension (load unpacked)
  manifest.json
  background.js     Service worker: debugger + event routing
  offscreen.html/js Persistent WebRTC peer (survives popup close)
  popup.html/js     Shows Peer ID + phone link
  peerjs.min.js     Bundled PeerJS (no CDN in extensions)

phone/
  index.html        Touchpad UI — deploy to GitHub Pages
```
