import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeSyncLogo from '../components/HomeSyncLogo';
import { AGENCY_ACTIVITY_EVENT, AGENCY_REQUESTS_EVENT, addAgencyReply, getClientActivities, getVisitRequests, updateVisitRequest } from '../services/agencyWorkspace';
import { useApp } from '../context/AppContext';
import './AgenceWorkspace.css';
import './AgenceOfferDetails.css';
import './AgencyInteraction.css';

const navigation = [
  ['dashboard', 'Tableau de bord'],
  ['clients', 'Clients'],
  ['annonces', 'Annonces'],
  ['messages', 'Messagerie'],
];

const formatDate = (date) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));

export default function AgenceWorkspace() {
  const navigate = useNavigate();
  const { annonces } = useApp();
  const [section, setSection] = useState('dashboard');
  const [requests, setRequests] = useState(getVisitRequests);
  const [activities, setActivities] = useState(getClientActivities);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [reply, setReply] = useState('');

  useEffect(() => {
    const refresh = () => setRequests(getVisitRequests());
    const refreshActivities = () => setActivities(getClientActivities());
    const refreshAll = () => { refresh(); refreshActivities(); };
    window.addEventListener(AGENCY_REQUESTS_EVENT, refresh);
    window.addEventListener(AGENCY_ACTIVITY_EVENT, refreshActivities);
    window.addEventListener('storage', refreshAll);
    return () => {
      window.removeEventListener(AGENCY_REQUESTS_EVENT, refresh);
      window.removeEventListener(AGENCY_ACTIVITY_EVENT, refreshActivities);
      window.removeEventListener('storage', refreshAll);
    };
  }, []);

  const pending = requests.filter((request) => request.status === 'pending');
  const accepted = requests.filter((request) => request.status === 'accepted');
  const clients = useMemo(() => Array.from(new Map(requests.map((request) => [request.clientName, request])).values()), [requests]);
  const selected = requests.find((request) => request.id === selectedId) || requests[0] || null;
  const updateStatus = (id, status) => {
    updateVisitRequest(id, { status });
    setSelectedId(id);
  };
  const sendReply = () => {
    if (!selected || !reply.trim()) return;
    addAgencyReply(selected.id, reply.trim());
    setReply('');
  };
  const openMessage = (request) => {
    setSelectedId(request.id);
    setSection('messages');
  };

  return <div className="agency-page">
    <header className="agency-nav">
      <button className="agency-brand" onClick={() => navigate('/')} aria-label="Accueil HomeSync"><HomeSyncLogo /></button>
      <div className="agency-title"><span>ESPACE PROFESSIONNEL</span><strong>Gestion agence</strong></div>
      <nav>{navigation.map(([id, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>{label}</button>)}</nav>
      <button className="agency-account" onClick={() => navigate('/profil')}>Agence démo</button>
    </header>

    <main className="agency-shell">
      <header className="agency-head">
        <div><span className="agency-kicker">{section === 'dashboard' ? 'Vue d’ensemble' : navigation.find(([id]) => id === section)?.[1]}</span><h1>{section === 'dashboard' ? 'Suivez vos clients et vos opportunités.' : navigation.find(([id]) => id === section)?.[1]}</h1><p>Les demandes issues de HomeSync apparaissent ici pour être traitées et suivies par l’équipe.</p></div>
        <button className="agency-primary" onClick={() => setSection('annonces')}>Voir les annonces</button>
      </header>

      {section === 'dashboard' && <>
        <section className="agency-metrics">
          <article><span>Demandes à traiter</span><strong>{pending.length}</strong><small>{pending.length ? 'Nécessitent une réponse' : 'Aucune demande en attente'}</small></article>
          <article><span>Visites acceptées</span><strong>{accepted.length}</strong><small>À confirmer avec le client</small></article>
          <article><span>Clients actifs</span><strong>{clients.length}</strong><small>Projets suivis dans HomeSync</small></article>
          <article><span>Annonces monitorées</span><strong>{annonces.length}</strong><small>Catalogue national connecté</small></article>
        </section>
        <section className="agency-dashboard-grid">
          <article className="agency-panel agency-requests"><div className="agency-panel-head"><div><span className="agency-kicker">Prioritaire</span><h2>Demandes de visite</h2></div><button onClick={() => setSection('clients')}>Voir les clients</button></div>{pending.length ? <div className="agency-request-list">{pending.slice(0, 4).map((request) => <RequestRow key={request.id} request={request} onAccept={() => updateStatus(request.id, 'accepted')} onDecline={() => updateStatus(request.id, 'declined')} onMessage={() => openMessage(request)} />)}</div> : <EmptyState label="Aucune demande de visite en attente" copy="Les demandes validées depuis l’espace client apparaîtront ici." />}</article>
          <article className="agency-panel agency-catalogue"><div className="agency-panel-head"><div><span className="agency-kicker">Catalogue national</span><h2>Annonces à surveiller</h2></div><button onClick={() => setSection('annonces')}>Tout voir</button></div><div className="agency-property-list">{annonces.slice(0, 3).map((property) => <PropertyRow key={property.id} property={property} onSelect={() => { setSelectedProperty(property); setSection('annonces'); }} />)}{!annonces.length && <EmptyState label="Chargement des annonces" copy="Le catalogue national sera disponible dès la connexion au backend." />}</div></article>
        </section>
        <section className="agency-panel agency-activity-panel"><div className="agency-panel-head"><div><span className="agency-kicker">Signaux client</span><h2>Activité récente sur les annonces</h2></div><span className="agency-count">{activities.length}</span></div>{activities.length ? <div className="agency-activity-list">{activities.slice(0, 6).map((activity) => <button key={activity.id} onClick={() => { const property = annonces.find((item) => String(item.id) === String(activity.property.id)); if (property) { setSelectedProperty(property); setSection('annonces'); } }}><span className="agency-activity-dot" /><span><strong>{activity.clientName}</strong><small>{activityLabel(activity.type)} · {activity.property.titre}</small></span><time>{formatDate(activity.createdAt)}</time></button>)}</div> : <EmptyState label="Aucun signal client récent" copy="Les sélections et retraits de biens seront suivis ici." />}</section>
      </>}

      {section === 'clients' && <section className="agency-panel agency-full-panel"><div className="agency-panel-head"><div><span className="agency-kicker">Suivi relation client</span><h2>Projets clients</h2></div><span className="agency-count">{clients.length} client{clients.length > 1 ? 's' : ''}</span></div>{clients.length ? <div className="agency-client-table">{clients.map((client) => <button key={client.id} onClick={() => openMessage(client)}><span className="agency-client-avatar">{client.clientName.charAt(0).toUpperCase()}</span><span><strong>{client.clientName}</strong><small>{client.property.titre} · {client.property.ville}</small></span><em className={`agency-status is-${client.status}`}>{statusLabel(client.status)}</em><time>{formatDate(client.updatedAt)}</time></button>)}</div> : <EmptyState label="Pas encore de client suivi" copy="Une demande de visite créée depuis l’espace client ouvrira automatiquement un dossier ici." />}</section>}

      {section === 'annonces' && (selectedProperty ? <OfferDetails property={selectedProperty} requestCount={requests.filter((request) => String(request.property.id) === String(selectedProperty.id)).length} onBack={() => setSelectedProperty(null)} /> : <section className="agency-panel agency-full-panel"><div className="agency-panel-head"><div><span className="agency-kicker">Monitoring catalogue</span><h2>Annonces disponibles</h2></div><span className="agency-count">{annonces.length} annonce{annonces.length > 1 ? 's' : ''}</span></div><div className="agency-listings-grid">{annonces.slice(0, 12).map((property) => <button key={property.id} className="agency-listing" onClick={() => setSelectedProperty(property)}><img src={property.img || property.photos?.[0]} alt="" /><div><span>{property.ville || property.quartier || 'France'}</span><strong>{property.titre || property.type || 'Bien immobilier'}</strong><small>{property.prix?.toLocaleString('fr-FR')} € · {property.surface || '—'} m²</small></div></button>)}</div>{!annonces.length && <EmptyState label="Le catalogue est indisponible" copy="Vérifiez la connexion au backend pour récupérer les annonces." />}</section>)}

      {section === 'messages' && <section className="agency-message-layout"><aside className="agency-panel agency-message-list"><div className="agency-panel-head"><div><span className="agency-kicker">Conversations</span><h2>Clients</h2></div><span className="agency-count">{requests.length}</span></div>{requests.length ? requests.map((request) => <button key={request.id} className={selected?.id === request.id ? 'active' : ''} onClick={() => setSelectedId(request.id)}><span className="agency-client-avatar">{request.clientName.charAt(0).toUpperCase()}</span><span><strong>{request.clientName}</strong><small>{request.property.titre}</small></span><em className={`agency-status is-${request.status}`}>{statusLabel(request.status)}</em></button>) : <EmptyState label="Aucune conversation" copy="Les messages de clients apparaîtront ici." />}</aside><article className="agency-panel agency-thread">{selected ? <><header><div><span className="agency-kicker">{statusLabel(selected.status)}</span><h2>{selected.clientName}</h2><p>{selected.property.titre} · {selected.property.ville}</p></div>{selected.status === 'pending' && <div className="agency-thread-actions"><button onClick={() => updateStatus(selected.id, 'declined')}>Refuser</button><button className="accept" onClick={() => updateStatus(selected.id, 'accepted')}>Accepter la visite</button></div>}</header><div className="agency-thread-history"><div className="agency-client-message">{selected.message || 'Demande de visite reçue.'}</div>{(selected.replies || []).map((item) => <div className={item.author === 'client' ? 'agency-client-message' : item.author === 'system' ? 'system-message' : 'agency-agent-message'} key={item.id}>{item.text}</div>)}</div><div className="agency-reply"><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Répondre au client…" /><button onClick={sendReply} disabled={!reply.trim()}>Envoyer</button></div></> : <EmptyState label="Sélectionnez une conversation" copy="Vous pourrez répondre au client et traiter la demande de visite." />}</article></section>}
    </main>
  </div>;
}

function statusLabel(status) {
  return ({ pending: 'À traiter', accepted: 'Visite acceptée', declined: 'Refusée' })[status] || 'À traiter';
}

function activityLabel(type) {
  return type === 'selection_removed' ? 'a retiré ce bien de sa sélection' : 'a ajouté ce bien à sa sélection';
}

function RequestRow({ request, onAccept, onDecline, onMessage }) {
  return <article className="agency-request-row"><div><span className="agency-client-avatar">{request.clientName.charAt(0).toUpperCase()}</span><span><strong>{request.clientName}</strong><small>{request.property.titre} · {request.property.ville}</small></span></div><time>{formatDate(request.createdAt)}</time><div className="agency-row-actions"><button onClick={onDecline}>Refuser</button><button onClick={onMessage}>Message</button><button className="accept" onClick={onAccept}>Accepter</button></div></article>;
}

function PropertyRow({ property, onSelect }) {
  return <button className="agency-property-row" onClick={onSelect}><img src={property.img || property.photos?.[0]} alt="" /><div><strong>{property.titre || property.type || 'Bien immobilier'}</strong><span>{property.ville || property.quartier || 'France'} · {property.surface || '—'} m²</span></div><b>{property.prix?.toLocaleString('fr-FR')} €</b></button>;
}

function OfferDetails({ property, requestCount, onBack }) {
  const facts = [
    ['Prix', property.prix ? `${property.prix.toLocaleString('fr-FR')} €` : 'Non renseigné'],
    ['Surface', property.surface ? `${property.surface} m²` : 'Non renseignée'],
    ['Pièces', property.pieces || property.nb_pieces || 'Non renseigné'],
    ['Prix au m²', property.prixM2 ? `${property.prixM2.toLocaleString('fr-FR')} €/m²` : 'Non renseigné'],
    property.dpe && ['DPE', property.dpe],
    property.terrasse && ['Extérieur', 'Terrasse'],
  ].filter(Boolean);
  const sourceUrl = property.url_source || property.lien;
  return <section className="agency-offer-details"><header className="agency-offer-top"><button onClick={onBack}>Retour aux annonces</button><span className="agency-count">{requestCount} demande{requestCount > 1 ? 's' : ''} associée{requestCount > 1 ? 's' : ''}</span></header><div className="agency-offer-hero"><img src={property.img || property.photos?.[0]} alt={property.titre || property.type || 'Bien immobilier'} /><article><span className="agency-kicker">{[property.ville, property.quartier].filter(Boolean).join(' · ') || 'France'}</span><h2>{property.titre || property.type || 'Bien immobilier'}</h2><strong>{property.prix?.toLocaleString('fr-FR') || '—'} €</strong><p>Référence catalogue : {property.id}</p>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Consulter l’annonce source</a>}</article></div><div className="agency-offer-content"><article className="agency-panel"><span className="agency-kicker">Caractéristiques</span><div className="agency-offer-facts">{facts.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></article><article className="agency-panel"><span className="agency-kicker">Description</span><h3>Présentation du bien</h3><p className="agency-offer-description">{property.description || 'La description détaillée est disponible auprès de la source de l’annonce.'}</p><p className="agency-offer-note">Les informations affichées sont issues du catalogue national. Vérifiez-les auprès de l’annonceur avant toute décision.</p></article></div></section>;
}

function EmptyState({ label, copy }) {
  return <div className="agency-empty"><strong>{label}</strong><span>{copy}</span></div>;
}
