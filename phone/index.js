import { getAuth, logout, startLogin, derivePeerId, CLIENT_ID } from './auth.js';
import { MODELS, initChat, clearHistory, send as chatSend, abort as chatAbort } from './chat.js';

// ── Helpers ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('touchpad-view').classList.remove('active');
  $('speed-wrap').classList.remove('visible');
  $('btn-chat').classList.remove('visible');
  if (name === 'touchpad') {
    $('touchpad-view').classList.add('active');
    $('speed-wrap').classList.add('visible');
    if (auth) $('btn-chat').classList.add('visible');
  } else {
    $('screen-' + name).classList.add('active');
  }
}

function setStatus(text, dot) {
  $('status-label').textContent = text;
  $('status-label').className = dot === 'connected' ? 'connected' : '';
  $('status-dot').className = dot || '';
}

function showUser(user) {
  if (!user) { $('user-chip').classList.remove('visible'); return; }
  $('user-avatar').src = user.avatar_url;
  $('user-name').textContent = user.login;
  $('user-chip').classList.add('visible');
}

function showError(id, msg) { const e = $(id); e.textContent = msg; e.style.display = 'block'; }
function hideError(id) { $(id).style.display = 'none'; }

// ── Connection ─────────────────────────────────────────────────────────────
let auth = null;
let peer = null;
let conn = null;
let isScrollMode = false;
let retryTimer = null;

const urlParams = new URLSearchParams(location.search);
const manualPeerId = urlParams.get('peer'); // set by extension popup "Open on Phone" link

function send(event) { if (conn && conn.open) conn.send(event); }

function clearRetry() { if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; } }

function connectToPeer(peerId, { sendAuth = false, autoRetry = false } = {}) {
  clearRetry();
  hideError('conn-error');

  if (!peer || peer.destroyed) {
    peer = new Peer({ debug: 0 });
    peer.on('open', () => doConnect(peerId, { sendAuth, autoRetry }));
    peer.on('error', err => onPeerError(err, peerId, { sendAuth, autoRetry }));
    return;
  }
  doConnect(peerId, { sendAuth, autoRetry });
}

function doConnect(peerId, opts) {
  $('conn-label').textContent = opts.sendAuth ? 'Connecting to your browser…' : 'Connecting…';
  $('conn-sub').textContent = opts.sendAuth ? 'Open the Mouse Remote extension.' : '';
  showScreen('connecting');
  setStatus('Connecting…', 'connecting');

  conn = peer.connect(peerId, { reliable: false, serialization: 'json' });

  // If the offer goes to a stale peer that never responds, retry after 12s.
  const connTimeout = opts.autoRetry ? setTimeout(() => {
    if (conn && !conn.open) { conn.close(); conn = null; connectToPeer(peerId, opts); }
  }, 12000) : null;

  conn.on('open', () => {
    clearTimeout(connTimeout);
    if (opts.sendAuth && auth) conn.send({ type: 'auth', token: auth.token });
    setStatus('Connected', 'connected');
    showScreen('touchpad');
  });

  conn.on('close', () => {
    clearTimeout(connTimeout);
    conn = null;
    if (opts.autoRetry) {
      setStatus('Reconnecting…', 'connecting');
      retryTimer = setTimeout(() => connectToPeer(peerId, opts), 4000);
    } else {
      setStatus('Disconnected', '');
      showScreen('auth');
    }
  });

  conn.on('error', err => {
    clearTimeout(connTimeout);
    conn = null;
    showError('conn-error', 'Connection error: ' + (err.message || err));
  });
}

function onPeerError(err, peerId, opts) {
  if (err.type === 'peer-unavailable' && opts.autoRetry) {
    $('conn-label').textContent = 'Waiting for browser extension…';
    $('conn-sub').textContent = 'Make sure the Mouse Remote extension is open and you are signed in.';
    showScreen('connecting');
    retryTimer = setTimeout(() => connectToPeer(peerId, opts), 5000);
    return;
  }
  showError('conn-error', err.message || String(err.type));
}

// ── Touchpad gestures ──────────────────────────────────────────────────────
const touchpad = $('touchpad');
let touches = {}, touchMoved = false, touchStartTime = 0;

function addRipple(x, y) {
  const el = document.createElement('div');
  el.className = 'ripple';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  touchpad.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

touchpad.addEventListener('touchstart', e => {
  e.preventDefault();
  touchMoved = false; touchStartTime = Date.now();
  for (const t of e.changedTouches) touches[t.identifier] = { x: t.clientX, y: t.clientY };
}, { passive: false });

touchpad.addEventListener('touchmove', e => {
  e.preventDefault(); touchMoved = true;
  const s = parseFloat($('speed').value);
  for (const t of e.changedTouches) {
    const p = touches[t.identifier]; if (!p) continue;
    const dx = (t.clientX - p.x) * s, dy = (t.clientY - p.y) * s;
    send(e.touches.length === 1 && !isScrollMode ? { type: 'move', dx, dy } : { type: 'scroll', dx: dx * 2, dy: dy * 2 });
    touches[t.identifier] = { x: t.clientX, y: t.clientY };
  }
}, { passive: false });

touchpad.addEventListener('touchend', e => {
  e.preventDefault();
  const elapsed = Date.now() - touchStartTime;
  const n = Object.keys(touches).length;
  for (const t of e.changedTouches) {
    const r = touchpad.getBoundingClientRect();
    addRipple(t.clientX - r.left, t.clientY - r.top);
    delete touches[t.identifier];
  }
  if (!touchMoved && elapsed < 220 && e.touches.length === 0) {
    if (n === 1) send({ type: 'click' });
    else if (n === 2) send({ type: 'rightclick' });
  }
}, { passive: false });

touchpad.addEventListener('touchcancel', e => {
  for (const t of e.changedTouches) delete touches[t.identifier];
}, { passive: false });

// Action bar
function flash(btn) { btn.classList.add('active'); setTimeout(() => btn.classList.remove('active'), 200); }
$('btn-lclick').addEventListener('touchend', e => { e.preventDefault(); send({ type: 'click' }); flash(e.currentTarget); });
$('btn-rclick').addEventListener('touchend', e => { e.preventDefault(); send({ type: 'rightclick' }); flash(e.currentTarget); });
$('btn-scroll').addEventListener('touchend', e => {
  e.preventDefault(); isScrollMode = !isScrollMode;
  $('btn-scroll').classList.toggle('active', isScrollMode);
  $('scroll-hint').classList.toggle('visible', isScrollMode);
});

// ── Auth UI ────────────────────────────────────────────────────────────────
$('btn-github').addEventListener('click', () => {
  if (CLIENT_ID === 'YOUR_GITHUB_OAUTH_CLIENT_ID') {
    showError('auth-error', 'Auth not configured — see phone/auth.js');
    return;
  }
  startLogin();
});

$('btn-signout').addEventListener('click', () => {
  logout(); auth = null;
  if (conn) conn.close(); if (peer) { peer.destroy(); peer = null; }
  showUser(null); showScreen('auth'); setStatus('Mouse Remote', '');
});

$('peer-input').addEventListener('input', () => {
  $('btn-manual-go').disabled = $('peer-input').value.trim().length === 0;
  hideError('auth-error');
});

$('btn-manual-go').addEventListener('click', () => {
  const id = $('peer-input').value.trim();
  if (!id) return;
  connectToPeer(id, { sendAuth: !!auth, autoRetry: false });
});

$('btn-abort').addEventListener('click', () => {
  clearRetry(); if (conn) conn.close();
  showScreen('auth'); setStatus('Mouse Remote', '');
});

// ── Chat ───────────────────────────────────────────────────────────────────
// Populate model selector
MODELS.forEach((m, i) => {
  const opt = document.createElement('option');
  opt.value = m.id; opt.textContent = m.label;
  $('model-select').appendChild(opt);
});

function openChat() { $('chat-overlay').classList.add('active'); }
function closeChat() { $('chat-overlay').classList.remove('active'); }

function appendMsg(role, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = text;
  $('chat-messages').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return div;
}

let chatBusy = false;

function submitChat() {
  const text = $('chat-input').value.trim();
  if (!text || chatBusy) return;
  chatBusy = true;
  $('btn-send').disabled = true;
  $('chat-input').value = '';
  $('chat-input').style.height = '';

  appendMsg('user', text);
  const bubble = appendMsg('assistant', '…');

  let first = true;
  chatSend(text, $('model-select').value, {
    onChunk(delta) {
      if (first) { bubble.textContent = ''; first = false; }
      bubble.textContent += delta;
      bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
    },
    onDone() {
      chatBusy = false;
      $('btn-send').disabled = $('chat-input').value.trim().length === 0;
    },
    onError(msg) {
      bubble.remove();
      appendMsg('error', msg);
      chatBusy = false;
      $('btn-send').disabled = $('chat-input').value.trim().length === 0;
    },
  });
}

$('btn-chat').addEventListener('click', openChat);
$('btn-chat-back').addEventListener('click', () => { chatAbort(); closeChat(); });

$('chat-input').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  $('btn-send').disabled = this.value.trim().length === 0 || chatBusy;
});

$('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChat(); }
});

$('btn-send').addEventListener('click', submitChat);

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  auth = getAuth();

  if (auth) { showUser(auth.user); initChat(auth.token); }

  // Manual mode: peer ID provided directly in URL (extension popup link for no-auth users)
  if (manualPeerId) {
    connectToPeer(manualPeerId, { sendAuth: !!auth, autoRetry: false });
    return;
  }

  // Auto mode: derive peer ID from GitHub user ID
  if (auth) {
    connectToPeer(derivePeerId(auth.user.id), { sendAuth: true, autoRetry: true });
    return;
  }

  // Not authenticated, no peer ID → show gate
  showScreen('auth');
}

init();
