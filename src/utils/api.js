/**
 * API client with JWT auth
 */

function getToken() {
  const session = sessionStorage.getItem('spk_dc_session');
  if (!session) return null;
  try { return JSON.parse(session).token; } catch { return null; }
}

function getUser() {
  const session = sessionStorage.getItem('spk_dc_session');
  if (!session) return null;
  try { return JSON.parse(session).user; } catch { return null; }
}

function setSession(data) {
  sessionStorage.setItem('spk_dc_session', JSON.stringify(data));
}

function clearSession() {
  sessionStorage.removeItem('spk_dc_session');
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    window.location.reload();
    return null;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

async function apiUpload(url, formData) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { method: 'POST', headers, body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export { getToken, getUser, setSession, clearSession, apiFetch, apiUpload };
