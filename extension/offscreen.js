// Offscreen document: persistent WebRTC peer via PeerJS
// Lives in a dedicated document so the connection survives popup close/open

let peer = null;
let conn = null;

function send(message) {
  chrome.runtime.sendMessage(message);
}

function initPeer() {
  if (peer && !peer.destroyed) peer.destroy();

  peer = new Peer({ debug: 0 });

  peer.on('open', (id) => {
    console.log('[Offscreen] Peer open:', id);
    send({ type: 'PEER_READY', peerId: id });
  });

  peer.on('connection', (incoming) => {
    // Only allow one connection at a time
    if (conn && conn.open) {
      incoming.close();
      return;
    }

    conn = incoming;
    console.log('[Offscreen] Incoming connection from:', conn.peer);

    conn.on('open', () => send({ type: 'PEER_CONNECTED' }));

    conn.on('data', (data) => send({ type: 'MOUSE_EVENT', event: data }));

    conn.on('close', () => {
      conn = null;
      send({ type: 'PEER_DISCONNECTED' });
    });

    conn.on('error', (err) => {
      console.error('[Offscreen] conn error:', err);
      conn = null;
      send({ type: 'PEER_DISCONNECTED' });
    });
  });

  peer.on('disconnected', () => {
    console.log('[Offscreen] Peer server disconnected, reconnecting…');
    if (!peer.destroyed) peer.reconnect();
  });

  peer.on('error', (err) => {
    console.error('[Offscreen] Peer error:', err.type, err);
    // Non-fatal errors (e.g. peer-unavailable) don't need a full restart
    if (err.type === 'server-error' || err.type === 'network') {
      setTimeout(initPeer, 5000);
    }
  });
}

initPeer();
