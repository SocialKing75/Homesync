import { useEffect, useMemo, useRef, useState } from 'react';
import { connected } from '../services/connected';
import { errorText, getToken, setToken } from '../api';
import ConnectedMap from './ConnectedMap';
import MicButton from '../components/MicButton';
import './HomeSync.css';

const price = n => n == null ? 'Prix à confirmer' : `${n.toLocaleString('fr-FR')} €`;
const read = () => { try { return JSON.parse(localStorage.getItem('homesync_connected') || '{}'); } catch { return {}; } };
const initial = [{ role: 'assistant', text: 'Bonjour ! Dans quelle ville souhaitez-vous acheter votre prochain logement ?' }];

export default function HomeSync() {
  const [saved] = useState(read);
  const [started, setStarted] = useState(!!saved.started);
  const [messages, setMessages] = useState(saved.messages || initial);
  const [sessionId, setSessionId] = useState(saved.sessionId || crypto.randomUUID());
  const [searchId, setSearchId] = useState(saved.searchId || '');
  const [preview, setPreview] = useState(saved.preview || null);
  const [annonces, setAnnonces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [likes, setLikes] = useState([]);
  const [favorites, setFavorites] = useState(false);
  const [account, setAccount] = useState(null);
  const [auth, setAuth] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [devLink, setDevLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [input, setInput] = useState('');
  const [micInfo, setMicInfo] = useState('');
  const [suggestions, setSuggestions] = useState(saved.suggestions || []);
  const [choice, setChoice] = useState(saved.choice || null);
  const [cities, setCities] = useState([]);
  const [tab, setTab] = useState('chat');
  const formTs = useRef(Date.now());
  const bottom = useRef(null);
  const modal = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    try { localStorage.setItem('homesync_connected', JSON.stringify({ started, messages, sessionId, searchId, preview, suggestions, choice })); } catch { /* Private browsing: current tab remains usable. */ }
  }, [started, messages, sessionId, searchId, preview, suggestions, choice]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);
  useEffect(() => {
    if (!auth && !selected) return;
    previousFocus.current = document.activeElement;
    modal.current?.focus();
    const key = e => {
      if (e.key === 'Escape') { setAuth(''); setSelected(null); }
      if (e.key === 'Tab') {
        const nodes = modal.current?.querySelectorAll('button:not(:disabled),input,a[href]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previousFocus.current?.focus(); };
  }, [auth, selected]);

  function failure(r) {
    setError(errorText(r.data));
    if (r.status === 401) { setAccount(null); setLikes([]); setAnnonces([]); setSelected(null); setAuth('login'); }
    if (r.status === 403) { setSelected(null); setAuth('login'); setNotice('Vérifiez votre adresse email puis connectez-vous. Vous pouvez demander un nouveau lien.'); }
  }
  async function loadLikes() {
    const r = await connected.likes();
    if (r.ok) setLikes(r.data); else failure(r);
  }
  async function loadResults(id) {
    const r = await connected.results(id);
    if (r.ok) { setAnnonces(r.data.annonces || []); setError(''); }
    else failure(r);
  }
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    connected.me().then(async r => {
      if (cancelled) return;
      if (r.ok) { setAccount(r.data); await loadLikes(); if (saved.searchId) await loadResults(saved.searchId); }
      else failure(r);
    });
    return () => { cancelled = true; };
    // Restore the existing session once, without replaying chat requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text) {
    if (!text.trim() || busy) return;
    setStarted(true); setBusy(true); setError(''); setInput(''); setCities([]);
    setMessages(m => [...m, { role: 'user', text }]);
    const r = await connected.chat({ message: text, sessionId, honeypot: '', formTs: formTs.current });
    if (!r.ok) { failure(r); setInput(text); setBusy(false); return; }
    const d = r.data;
    if (d.sessionId) setSessionId(d.sessionId);
    setMessages(m => [...m, { role: 'assistant', text: d.reply }]);
    setSuggestions(d.suggestions || []); setChoice(d.choix || null);
    if (d.resultats) {
      setPreview(d.resultats); setSearchId(d.resultats.search_id); setAnnonces([]); setSelected(null); setFavorites(false);
      if (d.require_account || !getToken()) { setNotice('Un compte vérifié est nécessaire pour consulter les annonces complètes.'); setAuth('register'); }
      else await loadResults(d.resultats.search_id);
    }
    setBusy(false);
  }
  async function authenticate(e) {
    e.preventDefault(); setAuthBusy(true); setError(''); setNotice(''); setDevLink('');
    const r = await connected[auth]({ email, password });
    setPassword('');
    if (!r.ok) failure(r);
    else if (auth === 'register') { setNotice(r.data.message); setDevLink(r.data.dev_lien || ''); }
    else {
      setToken(r.data.access_token); setAccount(r.data.user); setAuth(''); setNotice('');
      await loadLikes(); if (searchId) await loadResults(searchId);
    }
    setAuthBusy(false);
  }
  async function logout() {
    const r = await connected.logout();
    if (!r.ok && r.status !== 401) { failure(r); return; }
    setToken(null); setAccount(null); setLikes([]); setAnnonces([]); setSelected(null); setFavorites(false); setNotice('Vous êtes déconnecté. Votre recherche est conservée.');
  }
  async function toggleLike(a, type = 'classique') {
    if (!account) { setSelected(null); setAuth('login'); return; }
    setLikeBusy(true); setError('');
    const existing = likes.find(l => l.annonce_id === a.id_source);
    const r = existing?.type === type ? await connected.unlike(a.id_source) : await connected.like(a.id_source, type);
    if (r.ok) await loadLikes(); else failure(r);
    setLikeBusy(false);
  }
  const visible = useMemo(() => favorites ? likes.filter(l => l.annonce).map(l => annonces.find(a => a.id_source === l.annonce_id) || { ...l.annonce, id_source: l.annonce_id, type: l.annonce.type_bien, url_source: l.annonce.url }) : annonces, [favorites, likes, annonces]);
  const openAuth = mode => { setSelected(null); setError(''); setNotice(''); setDevLink(''); setAuth(mode); };
  const brand = <a className="hs-brand" href="/" aria-label="Accueil HomeSync">Home<span>Sync</span></a>;

  if (!started) return <div className="hs hs-landing"><header>{brand}<span className="hs-badge">Mode connecté · Achat immobilier</span></header><main className="hs-hero"><span className="hs-kicker">Recherche conversationnelle · France</span><h1>Votre prochain lieu de vie commence par une <em>conversation.</em></h1><p>Décrivez votre projet. Notre assistant précise vos envies et recherche dans notre catalogue.</p><article className="hs-start"><h2>Pour moi et mes proches</h2><p>Un logement à acheter, une recherche guidée et vos favoris personnels.</p><button onClick={() => { setStarted(true); formTs.current = Date.now(); }}>Commencer ma recherche <span>→</span></button></article><button className="hs-switch hs-landing-login" onClick={() => { setStarted(true); openAuth('login'); }}>J’ai déjà un compte · Se connecter</button><p className="hs-footnote">Parcours particulier connecté. Les recherches société et la collaboration ne sont pas disponibles dans cette version.</p></main></div>;

  return <div className="hs hs-app"><header>{brand}<span className="hs-badge">Mode connecté · Achat</span><nav><button className={!favorites ? 'active' : ''} onClick={() => { setFavorites(false); setTab('results'); }}>Recherche</button><button className={favorites ? 'active' : ''} onClick={async () => { if (!account) return openAuth('login'); setFavorites(true); setTab('results'); await loadLikes(); }}>Favoris ({likes.length})</button>{account ? <button onClick={logout}>Se déconnecter</button> : <button className="hs-cta" onClick={() => openAuth('login')}>Se connecter</button>}</nav></header>
    {tab === 'results' && <button className="hs-chat-fab" aria-label="Ouvrir la conversation" onClick={() => setTab('chat')}><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-4.5 3.6A.9.9 0 0 1 2 20.9V5a2 2 0 0 1 2-2Zm3 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg></button>}
    {error && <p className="hs-alert" role="alert">{error}</p>}{notice && !auth && <p className="hs-status" role="status">{notice}</p>}
    <main className="hs-workspace"><section className={`hs-results ${tab === 'results' ? 'mobile-active' : ''}`} aria-label="Résultats de recherche"><ConnectedMap annonces={visible} selected={selected} onSelect={id => setSelected(visible.find(a => a.id_source === id))} /><div className="hs-list"><div className="hs-list-heading"><h2>{favorites ? 'Vos favoris' : 'Vos logements'} <small>{visible.length}</small></h2>{searchId && !favorites && <button className="hs-link" onClick={() => getToken() ? loadResults(searchId) : openAuth('login')}>Actualiser les résultats</button>}</div>{!visible.length && <p>{favorites ? 'Aucun favori enregistré.' : preview ? `${preview.count} résultat(s) annoncé(s). Connectez-vous pour les consulter ou actualisez la recherche.` : 'Les annonces apparaîtront ici après votre conversation. Aucun résultat fictif n’est ajouté.'}</p>}{visible.map(a => <article className={`hs-list-card ${selected?.id_source === a.id_source ? 'selected' : ''}`} key={a.id_source}><button className="hs-open" onClick={() => setSelected(a)}>{a.photos?.[0] ? <img src={a.photos[0]} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span className="hs-photo-placeholder">HomeSync</span>}<div><strong>{price(a.prix)}</strong><small>Prix d’achat</small><h3>{a.titre || a.type || 'Logement'}</h3><p>{a.ville || 'Ville à confirmer'} · {a.surface == null ? 'Surface à confirmer' : `${a.surface} m²`}</p>{a.match && <span className="hs-score">Matching {a.match.score}/100</span>}</div></button><button className="hs-like" disabled={likeBusy} onClick={() => toggleLike(a)} aria-label={likes.some(l => l.annonce_id === a.id_source) ? 'Modifier ou retirer le favori' : 'Ajouter aux favoris'}>{likes.find(l => l.annonce_id === a.id_source)?.type === 'gold' ? 'Gold' : likes.some(l => l.annonce_id === a.id_source) ? 'En favori' : 'Favori +'}</button></article>)}</div></section>
    <section className={`hs-chat ${tab === 'chat' ? 'mobile-active' : ''}`} aria-label="Conversation"><div className="hs-chat-title"><button className="hs-chat-back" onClick={() => setTab('results')}>← Carte & annonces ({visible.length})</button><span className="hs-kicker">Votre assistant immobilier</span><h2>Parlons de votre projet.</h2><p>Des annonces du catalogue, un matching expliqué.</p></div><div className="hs-messages" aria-live="polite">{messages.map((m, i) => <div className={`hs-message ${m.role}`} key={i}>{m.text}</div>)}{busy && <p role="status">Recherche en cours…</p>}{preview && <div className="hs-preview"><strong>{preview.count} résultat(s) dans le catalogue</strong>{preview.prix_min != null && <p>De {price(preview.prix_min)} à {price(preview.prix_max)} à l’achat</p>}<p>Les détails et les coordonnées sont accessibles avec un compte vérifié.</p><button onClick={() => getToken() ? loadResults(searchId) : openAuth('register')}>Voir les logements</button></div>}<div ref={bottom} /></div>
    {choice?.options?.length > 0 && <div className="hs-choices"><p>Choisissez jusqu’à {choice.max || 3} villes.</p>{choice.options.map(v => <button key={v} aria-pressed={cities.includes(v)} disabled={busy || (!cities.includes(v) && cities.length >= (choice.max || 3))} onClick={() => setCities(c => c.includes(v) ? c.filter(x => x !== v) : [...c, v])}>{v}</button>)}<button disabled={!cities.length || busy} onClick={() => send(cities.join(', '))}>Confirmer les villes</button></div>}
    {!choice && <div className="hs-choices">{suggestions.map(s => <button key={s} disabled={busy} onClick={() => s === 'Affiner ma recherche' ? (setInput(''), setMessages(m => [...m, { role: 'assistant', text: 'Que souhaitez-vous modifier ? Décrivez votre précision ci-dessous.' }])) : send(s)}>{s}</button>)}</div>}
    <form className="hs-compose" onSubmit={e => { e.preventDefault(); send(input); }}><label htmlFor="hs-request">Votre demande</label><div className="hs-compose-row"><textarea id="hs-request" maxLength={1000} value={input} onChange={e => setInput(e.target.value)} placeholder="Un appartement à Bordeaux, budget 300 000 €…" required /><MicButton value={input} onChange={setInput} onErreur={setMicInfo} /></div>{micInfo && <small role="status" className="hs-mic-info">{micInfo}</small>}<button disabled={busy || !input.trim() || input.length > 1000}>Envoyer →</button><small>N’envoyez pas de données personnelles dans la conversation.</small></form></section></main>
    {(auth || selected) && <div className="hs-backdrop" onClick={e => { if (e.target === e.currentTarget) { setAuth(''); setSelected(null); } }}><section className="hs-dialog" role="dialog" aria-modal="true" aria-labelledby="hs-dialog-title" ref={modal} tabIndex={-1}><button className="hs-close" aria-label="Fermer" onClick={() => { setAuth(''); setSelected(null); }}>×</button>{auth ? <><span className="hs-kicker">Votre compte HomeSync</span><h2 id="hs-dialog-title">{auth === 'register' ? 'Créer mon compte' : 'Se connecter'}</h2><p>Un compte vérifié pour retrouver vos annonces et vos favoris.</p><form onSubmit={authenticate}><label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Mot de passe<input type="password" autoComplete={auth === 'register' ? 'new-password' : 'current-password'} required minLength={auth === 'register' ? 10 : undefined} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>{auth === 'register' && <small>10 à 128 caractères, une minuscule, une majuscule et un chiffre.</small>}<button className="hs-cta" disabled={authBusy}>{authBusy ? 'Veuillez patienter…' : auth === 'register' ? 'S’inscrire' : 'Se connecter'}</button></form>{error && <p role="alert" className="hs-alert">{error}</p>}{notice && <p role="status">{notice}</p>}{devLink && <p><a href={devLink}>Vérifier mon email — lien de développement</a></p>}<button className="hs-switch" onClick={() => { setAuth(auth === 'register' ? 'login' : 'register'); setError(''); setNotice(''); setDevLink(''); }}>{auth === 'register' ? 'J’ai déjà un compte' : 'Créer un compte'}</button></> : <><span className="hs-kicker">Prix d’achat · {selected.ville || 'Ville à confirmer'}</span><h2 id="hs-dialog-title">{selected.titre || selected.type || 'Logement'}</h2>{selected.photos?.[0] && <img className="hs-detail-photo" src={selected.photos[0]} alt={selected.titre || 'Logement'} onError={e => { e.currentTarget.style.display = 'none'; }} />}<strong className="hs-detail-price">{price(selected.prix)}</strong><p>{selected.surface == null ? 'Surface à confirmer' : `${selected.surface} m²`} · {selected.nb_pieces == null ? 'Pièces à confirmer' : `${selected.nb_pieces} pièces`} · DPE {selected.dpe || 'à confirmer'}</p><p>{selected.description || 'Description à confirmer'}</p><div className="hs-equipment">{['jardin', 'terrasse', 'piscine'].map(k => <span key={k}>{k} : {selected[k] == null ? 'À confirmer' : selected[k] ? 'Oui' : 'Non'}</span>)}</div>{selected.match ? <div className="hs-matching"><h3>Matching {selected.match.score}/100</h3><p>Score et explications fournis par HomeSync.</p>{selected.match.detail?.map(d => <div key={d.critere}><strong>{d.critere} · {d.points}/{d.max}</strong><p>{d.explication}</p></div>)}</div> : <p>Matching non fourni pour ce favori. Relancez une recherche pour obtenir un score contextualisé.</p>}<div className="hs-detail-actions"><button disabled={likeBusy} onClick={() => toggleLike(selected)}>{likes.find(l => l.annonce_id === selected.id_source)?.type === 'classique' ? 'Retirer le favori' : 'Favori classique'}</button><button disabled={likeBusy} onClick={() => toggleLike(selected, 'gold')}>{likes.find(l => l.annonce_id === selected.id_source)?.type === 'gold' ? 'Retirer le favori Gold' : 'Favori Gold'}</button></div><small>Gold désigne votre préférence personnelle, pas une zone géographique ni un score.</small>{selected.url_source && <p><a href={selected.url_source} target="_blank" rel="noreferrer">Voir l’annonce d’origine ↗</a></p>}{error && <p role="alert">{error}</p>}</>}</section></div>}
  </div>;
}
