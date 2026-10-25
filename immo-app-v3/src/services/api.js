// =============================================================================
// immo-app-v3/src/services/api.js — Backend API Client
// =============================================================================
// Centralizes all communication between the React frontend and the FastAPI backend.
// =============================================================================

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/**
 * Fetch all properties from the backend dataset
 */
export async function fetchProperties() {
  const res = await fetch(`${API_BASE_URL}/api/properties`);
  if (!res.ok) throw new Error(`Failed to fetch properties: ${res.statusText}`);
  return res.json();
}

/**
 * National listing catalogue. The new backend indexes Bien'ici listings for
 * all of France; the semantic endpoint is public and returns complete location
 * and photo data suitable for the search, map and matching experiences.
 */
function normalizeNationalListing(listing) {
  return {
    ...listing,
    id: listing.id_source || listing.id,
    pieces: listing.nb_pieces || listing.pieces || 1,
    img: listing.photos?.[0] || listing.img,
    achatLocation: 'Achat',
    prixM2: listing.prix && listing.surface ? Math.round(listing.prix / listing.surface) : null,
    lng: listing.lon,
    lat: listing.lat,
    backend_score: listing.match?.score ?? listing.backend_score,
    matchDetail: listing.match?.detail,
  };
}

export async function searchNationalProperties(question = 'annonces immobilières appartement maison partout en France', n = 50) {
  const res = await fetch(`${API_BASE_URL}/api/rag/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, n }),
  });
  if (!res.ok) throw new Error(`Failed to load national listings: ${res.statusText}`);
  const results = await res.json();
  return results.map(normalizeNationalListing);
}

export async function fetchChatSearchResults(searchId) {
  const token = localStorage.getItem('immo_token');
  if (!token || !searchId) return null;
  const res = await fetch(`${API_BASE_URL}/api/chat/resultats/${encodeURIComponent(searchId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load chat results: ${res.statusText}`);
  const payload = await res.json();
  return { ...payload, annonces: (payload.annonces || []).map(normalizeNationalListing) };
}

export async function sendChatMessage({ message, sessionId, formTs }) {
  const token = localStorage.getItem('immo_token');
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ message, sessionId, formTs, honeypot: '' }),
  });
  if (!res.ok) throw new Error(`Chat unavailable: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch detailed market comparison & valuation for a single property
 */
export async function fetchPropertyDetail(propId) {
  const res = await fetch(`${API_BASE_URL}/api/properties/${propId}`);
  if (!res.ok) throw new Error(`Failed to fetch property ${propId}: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch full dynamic market dashboard aggregations
 */
export async function fetchMarketDashboard() {
  const res = await fetch(`${API_BASE_URL}/api/market/dashboard`);
  if (!res.ok) throw new Error(`Failed to fetch market dashboard: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch global market stats & district breakdowns
 */
export async function fetchStats() {
  const res = await fetch(`${API_BASE_URL}/api/stats`);
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.statusText}`);
  return res.json();
}

/**
 * Score and rank properties against a buyer profile using backend recommendation algorithm
 */
export async function scoreProperties(profile) {
  const payload = {
    pieces: profile.pieces || 1,
    quartiers: profile.quartiers || [],
    prixMax: profile.prixMax || 0,
    mensualiteMax: profile.mensualiteMax || 0,
    typeBien: profile.typeBien || 'Appartement',
    achatLocation: profile.achatLocation || 'Achat',
    environnement: profile.environnement || [],
  };

  const res = await fetch(`${API_BASE_URL}/api/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to score properties: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch top undervalued properties detected by k-NN algorithm
 */
export async function fetchKnnOpportunities() {
  const res = await fetch(`${API_BASE_URL}/api/knn_opportunities`);
  if (!res.ok) throw new Error(`Failed to fetch k-NN opportunities: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch Simple Linear Regression model points, line, R², RMSE, and residuals
 */
export async function fetchRegressionData() {
  const res = await fetch(`${API_BASE_URL}/api/regression`);
  if (!res.ok) throw new Error(`Failed to fetch regression data: ${res.statusText}`);
  return res.json();
}

/**
 * Predict property price using the backend OLS machine learning model
 */
export async function predictPrice(features) {
  const payload = {
    surface_m2: Number(features.surface_m2) || 0,
    rooms: Number(features.rooms) || 1,
    floor: Number(features.floor) || 0,
    year_built: Number(features.year_built) || 2000,
    distance_to_center_km: Number(features.distance_to_center_km) || 1.5,
  };

  const res = await fetch(`${API_BASE_URL}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to predict price: ${res.statusText}`);
  return res.json();
}

/**
 * Get the direct download URL for a property PDF appraisal report
 */
export function getReportUrl(propId) {
  return `${API_BASE_URL}/api/report/${propId}`;
}
