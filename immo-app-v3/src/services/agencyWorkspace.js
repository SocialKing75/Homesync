const VISIT_REQUESTS_KEY = 'homesync_agency_visit_requests';
const CLIENT_ACTIVITY_KEY = 'homesync_agency_client_activity';
export const AGENCY_REQUESTS_EVENT = 'homesync:agency-requests';
export const AGENCY_ACTIVITY_EVENT = 'homesync:agency-activity';

function readStorage() {
  try {
    const value = JSON.parse(localStorage.getItem(VISIT_REQUESTS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveStorage(requests) {
  localStorage.setItem(VISIT_REQUESTS_KEY, JSON.stringify(requests));
  window.dispatchEvent(new CustomEvent(AGENCY_REQUESTS_EVENT));
}

export function getVisitRequests() {
  return readStorage();
}

function readActivityStorage() {
  try {
    const value = JSON.parse(localStorage.getItem(CLIENT_ACTIVITY_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function getClientActivities() {
  return readActivityStorage();
}

export function recordClientActivity({ type, annonce, clientName = 'Marc Ivan' }) {
  const activity = {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    clientName,
    createdAt: new Date().toISOString(),
    property: {
      id: annonce?.id,
      titre: annonce?.titre || annonce?.type || 'Bien immobilier',
      ville: annonce?.ville || annonce?.quartier || 'France',
    },
  };
  const activities = [activity, ...readActivityStorage()].slice(0, 60);
  localStorage.setItem(CLIENT_ACTIVITY_KEY, JSON.stringify(activities));
  window.dispatchEvent(new CustomEvent(AGENCY_ACTIVITY_EVENT));
  return activity;
}

export function createVisitRequest({ annonce, clientName = 'Marc Ivan', message = '' }) {
  const request = {
    id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'pending',
    clientName,
    clientEmail: 'client@homesync.fr',
    message,
    replies: [],
    property: {
      id: annonce?.id,
      titre: annonce?.titre || annonce?.type || 'Bien immobilier',
      ville: annonce?.ville || annonce?.quartier || 'France',
      prix: annonce?.prix,
      surface: annonce?.surface,
      img: annonce?.img || annonce?.photos?.[0] || '',
    },
  };
  const requests = [request, ...readStorage()];
  saveStorage(requests);
  return request;
}

export function updateVisitRequest(id, changes) {
  const requests = readStorage().map((request) => {
    if (request.id !== id) return request;
    const statusChanged = changes.status && changes.status !== request.status;
    const statusText = changes.status === 'accepted'
      ? 'Votre demande de visite a été acceptée par l’agence.'
      : changes.status === 'declined'
        ? 'L’agence ne peut pas donner suite à votre demande de visite.'
        : null;
    return {
      ...request,
      ...changes,
      updatedAt: new Date().toISOString(),
      replies: statusChanged && statusText
        ? [...(request.replies || []), { id: `${request.id}-status-${Date.now()}`, text: statusText, author: 'system', createdAt: new Date().toISOString() }]
        : request.replies || [],
    };
  });
  saveStorage(requests);
  return requests.find((request) => request.id === id) || null;
}

export function addAgencyReply(id, message) {
  return addMessage(id, message, 'agency');
}

export function addClientMessage(id, message) {
  return addMessage(id, message, 'client');
}

function addMessage(id, message, author) {
  const requests = readStorage().map((request) => request.id === id
    ? {
        ...request,
        updatedAt: new Date().toISOString(),
        replies: [...(request.replies || []), { id: `${id}-${Date.now()}`, text: message, author, createdAt: new Date().toISOString() }],
      }
    : request);
  saveStorage(requests);
  return requests.find((request) => request.id === id) || null;
}
