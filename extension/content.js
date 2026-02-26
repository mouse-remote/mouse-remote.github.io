// Content script — runs on https://mouse-remote.github.io/*
// Bridges localStorage auth data to the Chrome extension background.

const STORAGE_KEY = 'mr-auth';

function sendAuth(auth) {
  chrome.runtime.sendMessage({ type: 'AUTH_FROM_PAGE', auth }).catch(() => {});
}

// Send immediately if already authenticated (e.g. user returns to an already-logged-in tab)
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) sendAuth(JSON.parse(raw));
} catch (_) {}

// Send when auth is freshly saved (OAuth callback just completed)
document.addEventListener('mr-auth-ready', (e) => {
  try { sendAuth(e.detail); } catch (_) {}
});
