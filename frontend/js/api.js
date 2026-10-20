// One function for every call to your backend: it adds the login token for you.
import { CONFIG } from './config.js';
import { getToken, signOut } from './auth.js';

export async function api(path, { method = 'GET', body } = {}) {
  const token = await getToken();
  const r = await fetch(CONFIG.apiUrl + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { signOut(); location.reload(); }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error((data && data.error) || 'Request failed.');
  return data;
}
