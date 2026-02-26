// Offscreen document: persistent WebRTC peer via PeerJS.
// - On startup: sends OFFSCREEN_READY to background, gets back peer config.
// - On auth change: receives SET_PEER from background, reinits the peer.
// - After phone connects: verifies its GitHub token before accepting mouse events.

let peer = null;
let conn = null;
let currentPeerId = null;
let expectedUserId = null;
let phoneVerified = false;

function send(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

// ── GitHub token verification ─────────────────────────────────────────────

async function verifyToken(token, userId) {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'mouse-remote-extension' },
    });
    if (!res.ok) return false;
    const user = await res.json();
    return String(user.id) === String(userId);
  } catch { return false; }
}

// ── Connection handling ───────────────────────────────────────────────────

function closeConn() {
  if (conn) { try { conn.close(); } catch (_) {} conn = null; }
  phoneVerified = false;
}

function setupPeer(peerId, userId) {
  if (peerId === currentPeerId && peer && !peer.destroyed) return; // already correct

  if (peer && !peer.destroyed) peer.destroy();
  closeConn();

  currentPeerId = peerId;
  expectedUserId = userId;

  peer = peerId ? new Peer(peerId, { debug: 0 }) : new Peer({ debug: 0 });

  peer.on('open', (id) => {
    console.log('[Offscreen] Peer open:', id);
    send({ type: 'PEER_READY', peerId: id });
  });

  peer.on('connection', (incoming) => {
    // Last connection wins — kick any existing session so a fresh phone tab always works.
    if (conn && conn.open) closeConn();

    conn = incoming;
    phoneVerified = false;
    console.log('[Offscreen] Incoming connection from:', conn.peer);

    let authTimeout = null;

    conn.on('open', () => {
      if (expectedUserId !== null) {
        // Require phone to send its GitHub token within 8 seconds
        authTimeout = setTimeout(() => {
          console.warn('[Offscreen] Auth timeout — closing connection');
          closeConn();
          send({ type: 'PEER_DISCONNECTED' });
        }, 8000);
      } else {
        // No auth configured (unauthenticated / manual mode)
        phoneVerified = true;
        send({ type: 'PEER_CONNECTED' });
      }
    });

    conn.on('data', async (data) => {
      if (!phoneVerified) {
        if (data?.type === 'auth') {
          clearTimeout(authTimeout);
          const valid = await verifyToken(data.token, expectedUserId);
          if (valid) {
            phoneVerified = true;
            send({ type: 'PEER_CONNECTED' });
          } else {
            console.warn('[Offscreen] Phone auth rejected');
            closeConn();
            send({ type: 'PEER_DISCONNECTED' });
          }
        }
        return; // ignore everything until verified
      }
      send({ type: 'MOUSE_EVENT', event: data });
    });

    conn.on('close', () => {
      clearTimeout(authTimeout);
      closeConn();
      send({ type: 'PEER_DISCONNECTED' });
    });

    conn.on('error', (err) => {
      console.error('[Offscreen] conn error:', err);
      clearTimeout(authTimeout);
      closeConn();
      send({ type: 'PEER_DISCONNECTED' });
    });
  });

  peer.on('disconnected', () => {
    if (!peer.destroyed) peer.reconnect();
  });

  peer.on('error', (err) => {
    console.error('[Offscreen] Peer error:', err.type, err);
    if (err.type === 'unavailable-id') {
      // Stable peer ID is already taken (stale session) — retry in 10s
      setTimeout(() => setupPeer(currentPeerId, expectedUserId), 10000);
    } else if (err.type === 'server-error' || err.type === 'network') {
      setTimeout(() => setupPeer(currentPeerId, expectedUserId), 5000);
    }
  });
}

// ── Messages from background ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SET_PEER') {
    setupPeer(message.peerId, message.expectedUserId);
  }
});

// ── Startup: request config from background ───────────────────────────────

chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' }, (resp) => {
  if (chrome.runtime.lastError) {
    // Background not ready yet — start with random ID as fallback
    setupPeer(null, null);
    return;
  }
  setupPeer(resp?.peerId ?? null, resp?.expectedUserId ?? null);
});
