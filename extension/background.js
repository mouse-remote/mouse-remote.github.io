// Background service worker
// Manages: offscreen document (WebRTC via PeerJS), debugger, mouse dispatch

let state = {
  peerId: null,
  connected: false,
  cursorX: 640,
  cursorY: 400,
  tabId: null,
  debuggerAttached: false,
};

// --- Offscreen document (keeps WebRTC alive across popup open/close) ---

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')],
  });
  if (existing.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.WEB_RTC],
    justification: 'P2P WebRTC peer connection for phone mouse remote',
  });
}

// --- Debugger ---

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

  // Detach from previous tab if needed
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
  if (source.tabId === state.tabId) {
    state.debuggerAttached = false;
    state.tabId = null;
  }
});

async function sendDebuggerEvent(params) {
  try {
    await chrome.debugger.sendCommand({ tabId: state.tabId }, 'Input.dispatchMouseEvent', params);
  } catch (e) {
    console.error('[MouseRemote] dispatchMouseEvent failed:', e.message);
    state.debuggerAttached = false;
  }
}

// --- Mouse event dispatch ---

async function handleMouseEvent(event) {
  const ok = await ensureDebugger();
  if (!ok) return;

  const tab = await getActiveTab();
  const w = tab?.width || 1280;
  const h = tab?.height || 800;

  switch (event.type) {
    case 'move': {
      state.cursorX = Math.max(0, Math.min(w - 1, state.cursorX + event.dx));
      state.cursorY = Math.max(0, Math.min(h - 1, state.cursorY + event.dy));
      await sendDebuggerEvent({
        type: 'mouseMoved',
        x: state.cursorX,
        y: state.cursorY,
        button: 'none',
        buttons: 0,
        modifiers: 0,
        pointerType: 'mouse',
      });
      break;
    }
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
    case 'scroll': {
      await sendDebuggerEvent({
        type: 'mouseWheel',
        x: state.cursorX,
        y: state.cursorY,
        deltaX: event.dx || 0,
        deltaY: event.dy || 0,
        modifiers: 0,
        pointerType: 'mouse',
      });
      break;
    }
  }
}

// --- Broadcast to popup (best-effort, popup may be closed) ---

function broadcast(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

// --- Message bus ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATE':
      sendResponse({ peerId: state.peerId, connected: state.connected });
      return true; // keep channel open for async response

    case 'PEER_READY':
      state.peerId = message.peerId;
      broadcast({ type: 'STATE_UPDATE', peerId: state.peerId, connected: state.connected });
      break;

    case 'PEER_CONNECTED':
      state.connected = true;
      broadcast({ type: 'STATE_UPDATE', peerId: state.peerId, connected: true });
      break;

    case 'PEER_DISCONNECTED':
      state.connected = false;
      broadcast({ type: 'STATE_UPDATE', peerId: state.peerId, connected: false });
      break;

    case 'MOUSE_EVENT':
      handleMouseEvent(message.event);
      break;
  }
});

// Init on install / startup
ensureOffscreen().catch(console.error);
chrome.runtime.onStartup.addListener(() => ensureOffscreen().catch(console.error));
