// Background service worker
// Manages: auth state, offscreen document (WebRTC + WS)

let state = {
  auth: null,        // { token, user } — persisted in chrome.storage.local
  peerId: null,
  connected: false,
  nativeMode: false, // true when offscreen has an active ws://localhost:9999
};

// Must match phone/auth.js:derivePeerId
function derivePeerId(userId) { return 'mr-' + userId; }

// ── Auth ──────────────────────────────────────────────────────────────────

async function loadAuth() {
  const { auth } = await chrome.storage.local.get('auth');
  if (auth) state.auth = auth;
}

async function saveAuth(auth) {
  state.auth = auth;
  await chrome.storage.local.set({ auth });
}

async function clearAuth() {
  state.auth = null;
  await chrome.storage.local.remove('auth');
}

// ── Offscreen document ────────────────────────────────────────────────────
// Hosts PeerJS (WebRTC) and the WebSocket to the local Python server.
// On startup it sends OFFSCREEN_READY → background responds with peer config.
// On auth change → background sends SET_PEER to trigger reinit.

async function initOffscreenPeer() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')],
  });

  if (existing.length > 0) {
    chrome.runtime.sendMessage({
      type: 'SET_PEER',
      peerId: state.auth ? derivePeerId(state.auth.user.id) : null,
      expectedUserId: state.auth ? state.auth.user.id : null,
    }).catch(() => {});
  } else {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.WEB_RTC],
      justification: 'P2P WebRTC peer + local server WebSocket for mouse remote',
    });
  }
}

// ── Broadcast ─────────────────────────────────────────────────────────────

function broadcast(msg) { chrome.runtime.sendMessage(msg).catch(() => {}); }

function publicState() {
  return {
    peerId: state.peerId,
    connected: state.connected,
    nativeMode: state.nativeMode,
    user: state.auth?.user || null,
  };
}

// ── Message bus ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case 'GET_STATE':
      sendResponse(publicState());
      return true;

    // Offscreen just loaded — respond with peer config
    case 'OFFSCREEN_READY':
      sendResponse({
        peerId: state.auth ? derivePeerId(state.auth.user.id) : null,
        expectedUserId: state.auth ? state.auth.user.id : null,
      });
      return true;

    // Offscreen reports local server connect/disconnect
    case 'NATIVE_STATUS':
      state.nativeMode = message.connected;
      broadcast({ type: 'STATE_UPDATE', ...publicState() });
      break;

    // Content script bridged auth from phone page localStorage
    case 'AUTH_FROM_PAGE':
      saveAuth(message.auth).then(() => {
        initOffscreenPeer();
        broadcast({ type: 'STATE_UPDATE', ...publicState() });
      });
      // Auto-close the dedicated sign-in tab; leave the phone controller open on mobile.
      if (sender.tab?.url?.includes('/signin.html')) {
        chrome.tabs.remove(sender.tab.id);
      }
      break;

    case 'SIGN_OUT':
      clearAuth().then(() => {
        initOffscreenPeer();
        broadcast({ type: 'STATE_UPDATE', ...publicState() });
      });
      break;

    case 'PEER_READY':
      state.peerId = message.peerId;
      broadcast({ type: 'STATE_UPDATE', ...publicState() });
      break;

    case 'PEER_CONNECTED':
      state.connected = true;
      broadcast({ type: 'STATE_UPDATE', ...publicState() });
      break;

    case 'PEER_DISCONNECTED':
      state.connected = false;
      broadcast({ type: 'STATE_UPDATE', ...publicState() });
      break;
  }
});

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  await loadAuth();
  await initOffscreenPeer();
}

init().catch(console.error);
chrome.runtime.onStartup.addListener(() => init().catch(console.error));
