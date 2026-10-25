import { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import { useApp } from '../context/AppContext';
import { AGENCY_REQUESTS_EVENT, addClientMessage, createVisitRequest, getVisitRequests } from '../services/agencyWorkspace';
import './Messages.css';
import './AgencyInteraction.css';

const folders = ['Boîte de réception', 'Conversations', 'Visites planifiées', 'Archives'];

export default function Messages() {
  const { favoris } = useApp();
  const [requests, setRequests] = useState(getVisitRequests);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const refresh = () => setRequests(getVisitRequests());
    window.addEventListener(AGENCY_REQUESTS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(AGENCY_REQUESTS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const threads = useMemo(() => {
    const visitThreads = requests.map((request) => ({
      id: request.id,
      request,
      property: request.property,
      name: request.property.ville || 'Annonceur',
      label: request.property.titre,
      time: request.updatedAt,
    }));
    const requestedPropertyIds = new Set(visitThreads.map((thread) => String(thread.property.id)));
    const favoriteThreads = favoris
      .filter((property) => !requestedPropertyIds.has(String(property.id)))
      .map((property) => ({
        id: `property-${property.id}`,
        property,
        name: property.agence || property.ville || 'Annonceur partenaire',
        label: property.titre || `${property.type || 'Bien immobilier'} · ${property.surface || '—'} m²`,
        time: null,
      }));
    return [...visitThreads, ...favoriteThreads].filter((thread) => `${thread.name} ${thread.label}`.toLowerCase().includes(filter.toLowerCase()));
  }, [favoris, requests, filter]);

  useEffect(() => {
    if (threads.length && !threads.some((thread) => thread.id === activeId)) setActiveId(threads[0].id);
  }, [activeId, threads]);

  const current = threads.find((thread) => thread.id === activeId) || threads[0];
  const submit = () => {
    if (!current || !draft.trim()) return;
    if (current.request) addClientMessage(current.request.id, draft.trim());
    else createVisitRequest({ annonce: current.property, message: draft.trim() });
    setDraft('');
  };
  const prepareVisit = () => setDraft('Bonjour, je souhaiterais organiser une visite pour ce bien. Quelles disponibilités avez-vous cette semaine ?');

  return <div className="messages-page"><Navbar /><main className="messages-shell">
    <header className="messages-head"><div><span className="page-kicker">Espace projet</span><h1>Messagerie</h1></div><div className="messages-search"><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Rechercher une conversation" /></div></header>
    <section className="messages-layout">
      <aside className="mail-folders"><div className="mail-account"><span className="mail-account-mark">H</span><div><strong>Mon projet</strong><small>Conversation privée</small></div></div><nav>{folders.map((label, index) => <button key={label} className={index === 1 ? 'folder-active' : ''}><span>{label}</span>{index === 1 && <b>{threads.length}</b>}{index === 2 && requests.filter((request) => request.status === 'accepted').length > 0 && <b>{requests.filter((request) => request.status === 'accepted').length}</b>}</button>)}</nav><div className="folder-note">Les demandes sont partagées avec l’espace agence HomeSync. Vos critères privés ne le sont jamais.</div></aside>
      <aside className="thread-list"><div className="thread-list-top"><div><h2>Conversations</h2><span>{threads.length} discussion{threads.length > 1 ? 's' : ''}</span></div><button className="compose-button" onClick={prepareVisit}>Nouvelle demande</button></div>{threads.length ? threads.map((thread) => <button key={thread.id} className={`thread-row ${current?.id === thread.id ? 'active' : ''}`} onClick={() => setActiveId(thread.id)}><span className="thread-avatar">{thread.name.charAt(0).toUpperCase()}</span><span className="thread-copy"><strong>{thread.name}</strong><small>{thread.label}</small><em>{thread.request ? statusLabel(thread.request.status) : 'Préparer un échange'}</em></span><time>{thread.time ? formatDate(thread.time) : 'Brouillon'}</time></button>) : <div className="thread-empty"><strong>Aucune conversation</strong><p>Conservez un bien pour préparer un message à son annonceur.</p></div>}</aside>
      <article className="conversation-panel">{current ? <><header className="conversation-head"><span className="thread-avatar">{current.name.charAt(0).toUpperCase()}</span><div><h2>{current.name}</h2><p>{current.request ? `Demande de visite · ${statusLabel(current.request.status)}` : 'À propos du bien sélectionné'}</p></div><span className="conversation-status">{current.request ? statusLabel(current.request.status) : 'Brouillon privé'}</span></header><div className="message-history">{current.request ? <><span className="conversation-date">Demande partagée avec l’agence</span><div className="user-message">{current.request.message || 'Bonjour, je souhaiterais organiser une visite pour ce bien.'}</div>{(current.request.replies || []).map((reply) => <div className={reply.author === 'agency' ? 'agent-message' : reply.author === 'system' ? 'system-message' : 'user-message'} key={reply.id}>{reply.text}</div>)}</> : <><span className="conversation-date">Brouillon privé</span><div className="agent-message">Préparez votre message. Il créera une demande dans l’espace agence lorsque vous l’enverrez.</div></>}<div className="property-context"><img src={current.property.img || current.property.photos?.[0]} alt="Bien sélectionné" /><div><span>Bien concerné</span><strong>{current.property.titre || current.property.type}</strong><small>{current.property.prix?.toLocaleString('fr-FR')} € · {current.property.surface} m² · {current.property.ville || current.property.quartier}</small></div></div></div><div className="message-composer"><div className="message-actions"><button onClick={prepareVisit}>Demande de visite</button><button onClick={() => setDraft('Pouvez-vous me confirmer les charges, le DPE et les disponibilités de visite ?')}>Poser une question</button></div><div className="composer-row"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Écrire un message…" /><button className="send-message" onClick={submit} disabled={!draft.trim()}>{current.request ? 'Envoyer' : 'Envoyer la demande'}</button></div><p>Ce fil est partagé avec l’espace agence de démonstration, sans envoi externe.</p></div></> : <div className="conversation-empty"><h2>Votre messagerie est prête</h2><p>Sélectionnez un bien conservé pour préparer un échange.</p></div>}</article>
    </section>
  </main></div>;
}

function statusLabel(status) {
  return ({ pending: 'En attente de l’agence', accepted: 'Visite acceptée', declined: 'Demande refusée' })[status] || 'En attente de l’agence';
}

function formatDate(date) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(date));
}
