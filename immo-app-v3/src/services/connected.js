import { api } from '../api';

/** @typedef {{critere:string, points:number, max:number, explication:string}} MatchDetail */
/** @typedef {{id_source:string, titre?:string, prix?:number, surface?:number, type?:string, ville?:string, quartier?:string, lat?:number, lon?:number, photos?:string[], match?:{score:number, detail:MatchDetail[]}}} Annonce */
/** Services du parcours connecté. Les DTO du serveur restent inchangés. */
export const connected = {
  chat: body => api('/api/chat', { method: 'POST', body }),
  /** @returns {Promise<{ok:boolean,status:number,data:{annonces:Annonce[]}}>} */
  results: id => api(`/api/chat/resultats/${encodeURIComponent(id)}`),
  me: () => api('/api/auth/me'),
  login: body => api('/api/auth/login', { method: 'POST', auth: false, body }),
  register: body => api('/api/auth/register', { method: 'POST', auth: false, body }),
  resend: email => api('/api/auth/resend-verification', { method: 'POST', auth: false, body: { email } }),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
  likes: () => api('/api/likes'),
  like: (id, type) => api(`/api/likes/${encodeURIComponent(id)}`, { method: 'PUT', body: { type } }),
  unlike: id => api(`/api/likes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
