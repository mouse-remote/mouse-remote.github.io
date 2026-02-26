const PHONE_BASE_URL = 'https://mouse-remote.github.io/phone/';

const dot          = document.getElementById('dot');
const modeBadge    = document.getElementById('mode-badge');
const authAuthed   = document.getElementById('auth-authed');
const authAnon     = document.getElementById('auth-anon');
const avatarEl     = document.getElementById('avatar');
const authedName   = document.getElementById('authed-name');
const statusEl     = document.getElementById('status-text');
const manualSec    = document.getElementById('manual-section');
const peerIdEl     = document.getElementById('peer-id');
const urlBox       = document.getElementById('url-box');
const btnCopy      = document.getElementById('btn-copy');
const btnOpen      = document.getElementById('btn-open');

function phoneUrl(peerId) {
  return `${PHONE_BASE_URL}?peer=${encodeURIComponent(peerId)}`;
}

function applyState({ peerId, connected, user, nativeMode }) {
  modeBadge.textContent = nativeMode ? 'System' : 'Browser';
  modeBadge.className = nativeMode ? 'system' : '';
  // Auth section
  if (user) {
    authAuthed.classList.add('visible');
    authAnon.classList.remove('visible');
    avatarEl.src = user.avatar_url;
    authedName.textContent = user.login;
    manualSec.classList.remove('visible');
  } else {
    authAuthed.classList.remove('visible');
    authAnon.classList.add('visible');
    manualSec.classList.add('visible');
  }

  // Connection status
  if (connected) {
    dot.className = 'status-dot connected';
    statusEl.textContent = 'Phone connected ✓';
    statusEl.className = 'status-text connected';
  } else if (user) {
    dot.className = 'status-dot waiting';
    statusEl.textContent = 'Waiting for phone to connect…';
    statusEl.className = 'status-text';
  } else {
    dot.className = peerId ? 'status-dot waiting' : 'status-dot';
    statusEl.textContent = peerId ? 'Waiting for phone to connect…' : 'Initializing…';
    statusEl.className = 'status-text';
  }

  // Manual peer ID section (shown when signed out)
  if (!user && peerId) {
    peerIdEl.textContent = peerId;
    peerIdEl.classList.remove('loading');

    const url = phoneUrl(peerId);
    urlBox.textContent = url;
    urlBox.classList.remove('loading');

    btnOpen.disabled = false;
    btnOpen.onclick = () => chrome.tabs.create({ url });
  }
}

// Fetch current state from background on open
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
  if (res) applyState(res);
});

// Live updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_UPDATE') applyState(message);
});

// Sign in: open phone page in new tab — content script will pick up the token
document.getElementById('btn-signin').addEventListener('click', () => {
  chrome.tabs.create({ url: PHONE_BASE_URL });
});

// Sign out
document.getElementById('btn-signout').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
});

// Copy phone link
btnCopy.addEventListener('click', () => {
  const url = urlBox.textContent;
  if (!url || urlBox.classList.contains('loading')) return;
  navigator.clipboard.writeText(url).then(() => {
    btnCopy.textContent = 'Copied!';
    btnCopy.classList.add('copied');
    setTimeout(() => { btnCopy.textContent = 'Copy'; btnCopy.classList.remove('copied'); }, 1800);
  });
});
