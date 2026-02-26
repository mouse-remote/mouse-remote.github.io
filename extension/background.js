// Background service worker
// Manages: auth state, offscreen document (WebRTC), debugger, mouse dispatch

let state = {
  auth: null,          // { token, user } — loaded from chrome.storage.local
  peerId: null,        // current PeerJS peer ID
  connected: false,
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
// The offscreen doc hosts the PeerJS WebRTC peer so it survives popup close/open.
// On startup it sends OFFSCREEN_READY → background responds with peer config.
// On auth change → background broadcasts SET_PEER to trigger reinit.

async function initOffscreenPeer() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')],
  });

  if (existing.length > 0) {
    // Already running — send auth update directly
    chrome.runtime.sendMessage({
      type: 'SET_PEER',
      peerId: state.auth ? derivePeerId(state.auth.user.id) : null,
      expectedUserId: state.auth ? state.auth.user.id : null,
    }).catch(() => {});
  } else {
    // Create fresh — it will send OFFSCREEN_READY when its scripts have loaded
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.WEB_RTC],
      justification: 'P2P WebRTC peer connection for phone mouse remote',
    });
  }
}

// ── Debugger ──────────────────────────────────────────────────────────────

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

async function injectCursor(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['cursor.js'] });
  } catch (_) {} // silently skip restricted pages
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
    await injectCursor(tab.id);
    return true;
  } catch (e) {
    console.error('[MouseRemote] Debugger attach failed:', e.message);
    return false;
  }
}

// Re-inject cursor when user navigates within the controlled tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === state.tabId && state.connected && changeInfo.status === 'complete') {
    injectCursor(tabId);
  }
});

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
      chrome.tabs.sendMessage(state.tabId, { type: 'CURSOR_MOVE', x: state.cursorX, y: state.cursorY }).catch(() => {});
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
      await sendDebuggerEvent({ type: 'mouseWheel', x: state.cursorX, y: state.cursorY, deltaX: -(event.dx || 0), deltaY: -(event.dy || 0), modifiers: 0, pointerType: 'mouse' });
      break;
  }
}

// ── Broadcast helpers ─────────────────────────────────────────────────────

function broadcast(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function publicState() {
  return {
    peerId: state.peerId,
    connected: state.connected,
    // Expose user info to popup but never the raw token
    user: state.auth?.user || null,
  };
}

// ── Message bus ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {

    // Popup asks for initial state
    case 'GET_STATE':
      sendResponse(publicState());
      return true;

    // Offscreen doc just loaded — tell it which peer to create
    case 'OFFSCREEN_READY':
      sendResponse({
        peerId: state.auth ? derivePeerId(state.auth.user.id) : null,
        expectedUserId: state.auth ? state.auth.user.id : null,
      });
      return true;

    // Content script picked up auth from the phone page (localStorage)
    case 'AUTH_FROM_PAGE':
      saveAuth(message.auth).then(() => {
        initOffscreenPeer();
        broadcast({ type: 'STATE_UPDATE', ...publicState() });
      });
      break;

    // Popup sign-out button
    case 'SIGN_OUT':
      clearAuth().then(() => {
        initOffscreenPeer();
        broadcast({ type: 'STATE_UPDATE', ...publicState() });
      });
      break;

    // From offscreen: peer server connection opened
    case 'PEER_READY':
      state.peerId = message.peerId;
      broadcast({ type: 'STATE_UPDATE', ...publicState() });
      break;

    // From offscreen: phone connected and verified
    case 'PEER_CONNECTED':
      state.connected = true;
      broadcast({ type: 'STATE_UPDATE', ...publicState() });
      break;

    // From offscreen: phone disconnected
    case 'PEER_DISCONNECTED':
      state.connected = false;
      if (state.tabId) chrome.tabs.sendMessage(state.tabId, { type: 'CURSOR_REMOVE' }).catch(() => {});
      broadcast({ type: 'STATE_UPDATE', ...publicState() });
      break;

    // From offscreen: incoming mouse event
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
