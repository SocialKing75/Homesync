// Client de l'API Python (FastAPI) : jeton de session + appels JSON.
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';

const TOKEN_KEY = 'immo_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* stockage indisponible : session limitée à l'onglet */ }
};

// Renvoie { ok, status, data } ; ne lève pas d'exception sur les erreurs HTTP.
export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401 && token) setToken(null); // session expirée
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { detail: 'Serveur injoignable.' } };
  }
}

// Envoi de fichier (multipart) avec le jeton de session
export async function apiUpload(path, formData) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      body: formData,
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
  } catch {
    return { ok: false, status: 0, data: { detail: 'Serveur injoignable.' } };
  }
}

// Téléchargement authentifié (pièce du dossier, ZIP) : enregistre le fichier sous `nom`
export async function apiDownload(path, nom) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) return false;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: nom });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// Message d'erreur FastAPI lisible (detail texte, objet {message} ou liste de validation)
export const errorText = (data, fallback = 'Une erreur est survenue.') => {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (d?.message) return d.manquantes?.length ? `${d.message} Manquant : ${d.manquantes.join(', ')}.` : d.message;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  return fallback;
};
