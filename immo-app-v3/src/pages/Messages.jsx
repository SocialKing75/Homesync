import { useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import { useApp } from '../context/AppContext';
import './Messages.css';

export default function Messages() {
  const { favoris } = useApp();
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState([]);
  const threads = useMemo(() => favoris.slice(0, 4).map((property, i) => ({
    property, name: property.agence || 'Agence partenaire', label: property.titre || `${property.type} · ${property.quartier}`,
    time: i === 0 ? 'Aujourd’hui' : 'Cette semaine',
  })), [favoris]);
  const current = threads[active];
  const send = () => { if (draft.trim()) { setSent(prev => [...prev, draft.trim()]); setDraft(''); } };

  return <div className="messages-page"><Navbar /><main className="messages-shell">
    <header className="messages-head"><div><span className="page-kicker">Espace projet</span><h1>Messagerie</h1><p>Préparez vos échanges avec les agences depuis vos biens retenus.</p></div><span className="messages-privacy">Conversation privée</span></header>
    <section className="messages-layout">
      <aside className="thread-list"><div className="thread-list-top"><h2>Conversations</h2><span>{threads.length}</span></div>{threads.length ? threads.map((thread, index) => <button key={thread.property.id} className={`thread-row ${active === index ? 'active' : ''}`} onClick={() => setActive(index)}><span className="thread-avatar">{thread.name.charAt(0)}</span><span><strong>{thread.name}</strong><small>{thread.label}</small></span><time>{thread.time}</time></button>) : <div className="thread-empty">Ajoutez un bien à vos favoris pour engager une conversation.</div>}</aside>
      <article className="conversation-panel">{current ? <><header className="conversation-head"><span className="thread-avatar">{current.name.charAt(0)}</span><div><h2>{current.name}</h2><p>À propos de {current.label}</p></div><span className="conversation-status">Disponible</span></header><div className="property-context"><img src={current.property.img || current.property.photos?.[0]} alt=""/><div><span>Bien retenu</span><strong>{current.property.prix?.toLocaleString('fr-FR')} € · {current.property.surface} m²</strong><small>{current.property.quartier}</small></div></div><div className="message-history"><div className="agent-message">Bonjour, je peux vous aider à préparer une demande de visite. Indiquez vos disponibilités et les questions que vous souhaitez poser.</div>{sent.map((message, index) => <div className="user-message" key={index}>{message}</div>)}</div><div className="message-composer"><div className="message-actions"><button onClick={() => setDraft('Bonjour, je souhaiterais organiser une visite pour ce bien.')}>Préparer une demande de visite</button><button onClick={() => setDraft('Pouvez-vous me confirmer les charges, le DPE et les disponibilités de visite ?')}>Préparer une question</button></div><div><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Écrire un message à l’agence…" /><button className="send-message" onClick={send} disabled={!draft.trim()}>Envoyer</button></div><p>Les messages ne sont transmis qu’après votre validation.</p></div></> : <div className="conversation-empty"><h2>Votre messagerie est prête</h2><p>Sélectionnez un bien enregistré pour démarrer un échange.</p></div>}</article>
    </section>
  </main></div>;
}
