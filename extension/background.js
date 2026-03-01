// Background service worker
// Manages: auth state, offscreen document (WebRTC + WS), debugger fallback

let state = {
  auth: null,          // { token, user } — persisted in chrome.storage.local
  peerId: null,
  connected: false,
  nativeMode: false,   // true when offscreen has an active ws://localhost:9999
  cursorX: 640,
  cursorY: 400,
  tabId: null,
  debuggerAttached: false,
};

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

// ── Debugger (browser-only fallback) ─────────────────────────────────────

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

function isAttachable(tab) {
  if (!tab?.url) return false;
  return !tab.url.startsWith('chrome://') &&
         !tab.url.startsWith('chrome-extension://') &&
         !tab.url.startsWith('devtools://') &&
         !tab.url.startsWith('about:');
}

async function ensureDebugger() {
  const tab = await getActiveTab();
  if (!tab || !isAttachable(tab)) return false;
  if (state.debuggerAttached && state.tabId === tab.id) return true;

  if (state.debuggerAttached && state.tabId) {
    try { await chrome.debugger.detach({ tabId: state.tabId }); } catch (_) {}
    state.debuggerAttached = false;
  }

  try {
    await chrome.debugger.attach({ tabId: tab.id }, '1.3');
    state.tabId = tab.id;
    state.debuggerAttached = true;
    return true;
  } catch (e) {
    console.error('[MouseRemote] Debugger attach failed:', e.message);
    return false;
  }
}

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId === state.tabId) { state.debuggerAttached = false; state.tabId = null; }
});

async function sendDebuggerEvent(params) {
  try {
    await chrome.debugger.sendCommand({ tabId: state.tabId }, 'Input.dispatchMouseEvent', params);
  } catch (e) {
    console.error('[MouseRemote] dispatchMouseEvent failed:', e.message);
    state.debuggerAttached = false;
  }
}

// ── Mouse events ──────────────────────────────────────────────────────────
// Native (system-wide): offscreen forwards directly to local WS server.
// Browser fallback:     background dispatches via chrome.debugger.

async function handleMouseEvent(event) {
  const ok = await ensureDebugger();
  if (!ok) return;

  const tab = await getActiveTab();
  const w = tab?.width || 1280, h = tab?.height || 800;

  switch (event.type) {
    case 'move':
      state.cursorX = Math.max(0, Math.min(w - 1, state.cursorX + event.dx));
      state.cursorY = Math.max(0, Math.min(h - 1, state.cursorY + event.dy));
      await sendDebuggerEvent({ type: 'mouseMoved', x: state.cursorX, y: state.cursorY, button: 'none', buttons: 0, modifiers: 0, pointerType: 'mouse' });
      break;
    case 'click': {
      const { cursorX: x, cursorY: y } = state;
      await sendDebuggerEvent({ type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, modifiers: 0, pointerType: 'mouse' });
      await sendDebuggerEvent({ type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, modifiers: 0, pointerType: 'mouse' });
      break;
    }
    case 'rightclick': {
      const { cursorX: x, cursorY: y } = state;
      await sendDebuggerEvent({ type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1, modifiers: 0, pointerType: 'mouse' });
      await sendDebuggerEvent({ type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1, modifiers: 0, pointerType: 'mouse' });
      break;
    }
    case 'scroll':
      await sendDebuggerEvent({ type: 'mouseWheel', x: state.cursorX, y: state.cursorY, deltaX: event.dx || 0, deltaY: event.dy || 0, modifiers: 0, pointerType: 'mouse' });
      break;
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

    // Only reaches here when native server is NOT available (offscreen routes
    // directly to WS when it is, never sending MOUSE_EVENT to background)
    case 'MOUSE_EVENT':
      handleMouseEvent(message.event);
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
