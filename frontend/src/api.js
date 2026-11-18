const BASE = import.meta.env.VITE_API_URL || '/api';

export const getToken = () => {
  try { return localStorage.getItem('token'); } catch { return null; }
};
export const setToken = (t) => {
  try { t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); } catch { /* ignore */ }
};

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

async function fail(res) {
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && getToken()) { setToken(null); window.dispatchEvent(new Event('auth:expired')); }
  const err = new Error(data?.message || `Request failed (${res.status})`);
  err.status = res.status;
  err.code = data?.code;
  err.data = data || {};
  throw err;
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    const err = new Error('Cannot reach the server. Check your connection and try again.');
    err.code = 'NETWORK';
    throw err;
  }
  if (!res.ok) await fail(res);
  try { return await res.json(); } catch { return null; }
}

// Download a file (e.g. PDF) with the auth header and hand it to the browser.
async function download(path, filename) {
  let res;
  try { res = await fetch(BASE + path, { headers: headers() }); } catch {
    const err = new Error('Cannot reach the server. Check your connection and try again.');
    err.code = 'NETWORK';
    throw err;
  }
  if (!res.ok) await fail(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  put: (p, b) => request('PUT', p, b ?? {}),
  patch: (p, b) => request('PATCH', p, b ?? {}),
  del: (p, b) => request('DELETE', p, b),
  download,
};
