// GitHub OAuth module for Mouse Remote phone page
//
// Setup:
//   1. Create a GitHub OAuth App → https://github.com/settings/developers
//      Homepage URL:   https://mouse-remote.github.io
//      Callback URL:   https://mouse-remote.github.io/phone/
//   2. Add mouse-remote to cors-proxy:
//      wrangler secret put mouse_remote_github_io   # in ~/Github/jonasneves/cors-proxy
//      Value: {"clientId":"<id>","clientSecret":"<secret>"}
//   3. Fill in CLIENT_ID below and push.

export const CLIENT_ID = 'Ov23liEg8hgt9jv5kFZ4';
const PROXY_URL        = 'https://cors-proxy.jonasneves.workers.dev';
const REDIRECT_URI     = 'https://mouse-remote.github.io/phone/';
const STORAGE_KEY      = 'mr-auth';
const NONCE_KEY        = 'mr-nonce';

// Both phone and extension derive the same stable peer ID from the GitHub user ID.
export function derivePeerId(userId) {
  return 'mr-' + userId;
}

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch { return null; }
}

export function saveAuth(token, user) {
  const data = { token, user };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // Signal the Chrome extension's content script (if it's watching this page).
  document.dispatchEvent(new CustomEvent('mr-auth-ready', { detail: data }));
  return data;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export function startLogin() {
  const nonce = crypto.randomUUID();
  sessionStorage.setItem(NONCE_KEY, nonce);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'read:user',
    state: btoa(JSON.stringify({ nonce })),
  });
  window.location.href = 'https://github.com/login/oauth/authorize?' + params;
}

// Call on page load when ?code= is present in the URL.
export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code  = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;

  window.history.replaceState({}, '', window.location.pathname);

  let payload;
  try { payload = JSON.parse(atob(state)); } catch { throw new Error('STATE_INVALID'); }

  const storedNonce = sessionStorage.getItem(NONCE_KEY);
  sessionStorage.removeItem(NONCE_KEY);
  if (payload.nonce !== storedNonce) throw new Error('NONCE_MISMATCH');

  const res = await fetch(PROXY_URL + '/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, code, redirect_uri: REDIRECT_URI }),
  });
  const data = await res.json();
  if (data.error || !data.access_token) throw new Error(data.error_description || data.error || 'TOKEN_FAILED');
  if (!data.user) throw new Error('USER_MISSING');

  return saveAuth(data.access_token, data.user);
}
