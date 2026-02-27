// GitHub OAuth module for Mouse Remote phone page

export const CLIENT_ID = 'Ov23li3dnFMUNHbu1SjZ';

// Both phone and extension derive the same stable peer ID from the GitHub user ID.
export function derivePeerId(userId) {
  return 'mr-' + userId;
}

export function getAuth() {
  try { return JSON.parse(localStorage.getItem('mr-auth')); }
  catch { return null; }
}

export function saveAuth(token, user) {
  const data = { token, user };
  localStorage.setItem('mr-auth', JSON.stringify(data));
  // Signal the Chrome extension's content script (if it's watching this page).
  document.dispatchEvent(new CustomEvent('mr-auth-ready', { detail: data }));
  return data;
}

export function logout() {
  localStorage.removeItem('mr-auth');
}

export function startLogin() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: 'https://neevs.io/auth/',
    scope: 'read:user',
    state: crypto.randomUUID(),
  });

  const popup = window.open(
    'https://github.com/login/oauth/authorize?' + params,
    'gh-oauth',
    'width=600,height=700,popup=1'
  );
  if (!popup) return;

  function onMsg(e) {
    if (e.data?.type !== 'gh-auth') return;
    window.removeEventListener('message', onMsg);
    if (e.data.auth) saveAuth(e.data.auth.token, e.data.auth.user);
    try { popup.close(); } catch {}
  }
  window.addEventListener('message', onMsg);
}
