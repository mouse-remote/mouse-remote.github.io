// ⚠️ Update this to match your GitHub Pages URL after creating the repo
const PHONE_BASE_URL = 'https://jonasneves.github.io/mouse-remote/phone/';

const dot       = document.getElementById('dot');
const peerIdEl  = document.getElementById('peer-id');
const urlBox    = document.getElementById('url-box');
const btnCopy   = document.getElementById('btn-copy');
const btnOpen   = document.getElementById('btn-open');
const statusEl  = document.getElementById('status-text');

function phoneUrl(peerId) {
  return `${PHONE_BASE_URL}?peer=${encodeURIComponent(peerId)}`;
}

function applyState({ peerId, connected }) {
  if (peerId) {
    peerIdEl.textContent = peerId;
    peerIdEl.classList.remove('loading');

    const url = phoneUrl(peerId);
    urlBox.textContent = url;
    urlBox.classList.remove('loading');

    btnOpen.disabled = false;
    btnOpen.onclick = () => chrome.tabs.create({ url });
  }

  if (connected) {
    dot.className = 'status-dot connected';
    statusEl.textContent = 'Phone connected ✓';
    statusEl.className = 'status-text connected';
  } else if (peerId) {
    dot.className = 'status-dot waiting';
    statusEl.textContent = 'Waiting for phone to connect…';
    statusEl.className = 'status-text';
  }
}

// Fetch current state from background on open
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
  if (res) applyState(res);
});

// Listen for live updates (peer ready, phone connected/disconnected)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_UPDATE') applyState(message);
});

// Copy button
btnCopy.addEventListener('click', () => {
  const url = urlBox.textContent;
  if (!url || urlBox.classList.contains('loading')) return;

  navigator.clipboard.writeText(url).then(() => {
    btnCopy.textContent = 'Copied!';
    btnCopy.classList.add('copied');
    setTimeout(() => {
      btnCopy.textContent = 'Copy';
      btnCopy.classList.remove('copied');
    }, 1800);
  });
});
