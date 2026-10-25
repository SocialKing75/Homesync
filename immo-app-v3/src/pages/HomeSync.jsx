import { useEffect, useMemo, useRef, useState } from 'react';
import { connected } from '../services/connected';
import { errorText } from '../api';
import ConnectedMap from './ConnectedMap';
import ListingPanel from '../components/ListingPanel';
import CompareTable from '../components/CompareTable';
import { VILLES } from '../components/introData';
import MicButton from '../components/MicButton';
import { T, formatPrice, getLang, saveLang } from '../i18n';
import './HomeSync.css';
import './HomeSyncFab.css';
import './HomeSyncCompose.css';

// Icônes monochromes de la navigation (couleur du texte).
const icon = d => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const ICONS = {
  search: icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  favourites: icon(<path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9Z" />),
  messages: icon(<path d="M4 5h16v11H9l-5 4V5Z" />),
  analysis: icon(<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M21 20H3" /></>),
};
// Trois profils, vacancier en premier : pictogramme blanc dans une pastille ronde de la couleur du profil.
const PROFILES = ['holiday', 'perso', 'pro'];
const GREETING = { holiday: 'greetingHoliday', perso: 'greeting', pro: 'greetingPro' };
const PROFILE_PATHS = {
  holiday: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M8 11v5M16 11v5" /></>,
  perso: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  pro: <><path d="M4 21V4h11v17" /><path d="M15 9h5v12" /><path d="M8 8h3M8 12h3M8 16h3" /><path d="M2 21h20" /></>,
};
const profileIcon = (id, size) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PROFILE_PATHS[id]}</svg>;
const median = list => { const s = [...list].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const COMPARE_MAX = 3;
// Favoris gardés dans le navigateur (le site n'a plus de comptes) : l'annonce complète est conservée.
const FAV_KEY = 'homesync_favourites';
const readFavourites = () => { try { const f = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(f) ? f : []; } catch { return []; } };
// Coordonnées des villes : d'abord celles du catalogue, sinon le géocodeur libre Photon (OpenStreetMap), limité à la France.
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const KNOWN_CITIES = new Map(VILLES.map(([v, , lat, lon]) => [norm(v), [lon, lat]]));
const geoCache = new Map();
async function locateCity(name) {
  const k = norm(name);
  if (KNOWN_CITIES.has(k)) return KNOWN_CITIES.get(k);
  if (geoCache.has(k)) return geoCache.get(k);
  let point = null;
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(name)}&limit=1&bbox=-5.6,41.2,9.9,51.2`);
    point = (await r.json()).features?.[0]?.geometry?.coordinates || null;
  } catch { /* Géocodeur injoignable : la carte ne bouge pas. */ }
  geoCache.set(k, point);
  return point;
}
const read = () => { try { return JSON.parse(localStorage.getItem('homesync_connected') || '{}'); } catch { return {}; } };
// Les messages de l'interface gardent une clé : ils suivent la langue choisie.
const initial = [{ role: 'assistant', key: 'greeting' }];

export default function HomeSync() {
  const [lang, setLang] = useState(getLang);
  const t = T[lang];
  const price = n => formatPrice(t, n);
  useEffect(() => { saveLang(lang); }, [lang]);
  const [saved] = useState(read);
  const [started, setStarted] = useState(!!saved.started);
  // Profil choisi à l'accueil : vacancier (vert, par défaut), particulier (bleu) ou entreprise (cuivre).
  const [profile, setProfile] = useState(PROFILES.includes(saved.profile) ? saved.profile : 'holiday');
  const [messages, setMessages] = useState(saved.messages || initial);
  const [sessionId, setSessionId] = useState(saved.sessionId || crypto.randomUUID());
  const [searchId, setSearchId] = useState(saved.searchId || '');
  const [preview, setPreview] = useState(saved.preview || null);
  const [annonces, setAnnonces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [likes, setLikes] = useState(readFavourites);
  useEffect(() => { try { localStorage.setItem(FAV_KEY, JSON.stringify(likes)); } catch { /* Navigation privée : les favoris valent pour l'onglet. */ } }, [likes]);
  const [favorites, setFavorites] = useState(false);
  const [view, setView] = useState('search');
  // Comparatif : jusqu'à 3 annonces, gardées dans le navigateur.
  const [compare, setCompare] = useState(() => { try { const c = JSON.parse(localStorage.getItem('homesync_compare') || '[]'); return Array.isArray(c) ? c.slice(0, COMPARE_MAX) : []; } catch { return []; } });
  const [compareOpen, setCompareOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState(null);
  const lastCities = useRef('');
  useEffect(() => { try { localStorage.setItem('homesync_compare', JSON.stringify(compare)); } catch { /* Navigation privée : le comparatif vaut pour l'onglet. */ } }, [compare]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [micInfo, setMicInfo] = useState('');
  const [suggestions, setSuggestions] = useState(saved.suggestions || []);
  const [choice, setChoice] = useState(saved.choice || null);
  const [cities, setCities] = useState([]);
  const [tab, setTab] = useState('chat');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileBtn = useRef(null);
  const profileMenu = useRef(null);
  const formTs = useRef(Date.now());
  const bottom = useRef(null);

  useEffect(() => {
    try { localStorage.setItem('homesync_connected', JSON.stringify({ started, profile, messages, sessionId, searchId, preview, suggestions, choice })); } catch { /* Private browsing: current tab remains usable. */ }
  }, [started, profile, messages, sessionId, searchId, preview, suggestions, choice]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);
  // Liste déroulante du profil : fermeture sur Échap ou clic à l'extérieur.
  useEffect(() => {
    if (!profileOpen) return;
    profileMenu.current?.querySelector('[aria-selected=true]')?.focus();
    const out = e => { if (!profileMenu.current?.parentElement.contains(e.target)) setProfileOpen(false); };
    const key = e => { if (e.key === 'Escape') { setProfileOpen(false); profileBtn.current?.focus(); } };
    document.addEventListener('mousedown', out); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); };
  }, [profileOpen]);

  function failure(r) {
    setError(errorText(r.data));
  }
  async function loadResults(id) {
    const r = await connected.results(id, lang);
    if (r.ok) { setAnnonces(r.data.annonces || []); setError(''); }
    else failure(r);
  }
  useEffect(() => {
    if (saved.searchId) loadResults(saved.searchId);
    // Restaure une fois la recherche en cours, sans rejouer la conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text) {
    if (!text.trim() || busy) return;
    setStarted(true); setBusy(true); setError(''); setInput(''); setCities([]);
    setMessages(m => [...m, { role: 'user', text }]);
    const r = await connected.chat({ message: text, sessionId, honeypot: '', formTs: formTs.current, profil: profile, lang });
    if (!r.ok) { failure(r); setInput(text); setBusy(false); return; }
    const d = r.data;
    const villes = d.slots?.villes || (d.slots?.ville ? [d.slots.ville] : []);
    if (villes.length && villes.join('|') !== lastCities.current) {
      lastCities.current = villes.join('|');
      Promise.all(villes.slice(0, 3).map(locateCity)).then(points => { const ok = points.filter(Boolean); if (ok.length) setMapFocus({ points: ok, key: Date.now() }); });
    }
    if (d.sessionId) setSessionId(d.sessionId);
    setMessages(m => [...m, { role: 'assistant', text: d.reply }]);
    setSuggestions(d.suggestions || []); setChoice(d.choix || null);
    if (d.resultats) {
      setPreview(d.resultats); setSearchId(d.resultats.search_id); setAnnonces([]); setSelected(null); setFavorites(false);
      await loadResults(d.resultats.search_id);
    }
    setBusy(false);
  }
  function toggleLike(a, type = 'classique') {
    setLikes(list => {
      const existing = list.find(l => l.annonce_id === a.id_source);
      if (existing?.type === type) return list.filter(l => l.annonce_id !== a.id_source);
      return [...list.filter(l => l.annonce_id !== a.id_source), { annonce_id: a.id_source, type, annonce: a }];
    });
  }
  const visible = useMemo(() => favorites ? likes.filter(l => l.annonce).map(l => annonces.find(a => a.id_source === l.annonce_id) || l.annonce) : annonces, [favorites, likes, annonces]);
  // Analyse calculée sur les annonces réellement renvoyées par la recherche.
  const stats = useMemo(() => {
    const prix = annonces.map(a => a.prix).filter(n => typeof n === 'number' && n > 0);
    if (!prix.length) return null;
    const m2 = annonces.filter(a => a.prix > 0 && a.surface > 0).map(a => a.prix / a.surface);
    const surfaces = annonces.map(a => a.surface).filter(n => n > 0);
    const scores = annonces.map(a => a.match?.score).filter(n => typeof n === 'number');
    const villes = Object.entries(annonces.reduce((acc, a) => { if (a.ville) acc[a.ville] = (acc[a.ville] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { night: annonces.every(a => a.unite_prix === 'nuit'), count: annonces.length, median: median(prix), min: Math.min(...prix), max: Math.max(...prix), m2: m2.length ? median(m2) : null, surface: surfaces.length ? median(surfaces) : null, score: scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null, villes };
  }, [annonces]);
  const analysisPanel = <div className="hs-analysis" role="region" aria-labelledby="hs-analysis-title"><div className="hs-analysis-heading"><h2 id="hs-analysis-title">{t.analysisTitle}</h2><button className="hs-close" aria-label={t.closeAnalysis} onClick={() => setView('search')}>×</button></div>{!stats ? <p>{t.analysisEmpty}</p> : <div className="hs-stats">
    <div><small>{t.statListings}</small><strong>{stats.count}</strong></div>
    <div><small>{stats.night ? t.statMedianNight : t.statMedian}</small><strong>{price(stats.median)}</strong></div>
    <div><small>{t.statPpm2}</small><strong>{stats.m2 == null ? '—' : `${price(Math.round(stats.m2))}/m²`}</strong></div>
    <div><small>{t.statRange}</small><strong>{price(stats.min)} – {price(stats.max)}</strong></div>
    <div><small>{t.statSurface}</small><strong>{stats.surface == null ? '—' : `${Math.round(stats.surface)} m²`}</strong></div>
    <div><small>{t.statMatch}</small><strong>{stats.score == null ? '—' : `${stats.score}/100`}</strong></div>
    {stats.villes.length > 0 && <div className="hs-stats-wide"><small>{t.statCities}</small><strong>{stats.villes.map(([v, n]) => `${v} (${n})`).join(' · ')}</strong></div>}
  </div>}</div>;
  // Un nouveau profil n'efface pas une conversation déjà commencée.
  const choose = id => { setProfile(id); if (messages.length <= 1) setMessages(initial); };
  const brand = <a className="hs-brand" href="/" aria-label={t.home} onClick={e => { e.preventDefault(); setSelected(null); setStarted(false); }}>Home<span>Sync</span></a>;
  // Sélecteur de langue à deux segments : la langue active prend la couleur du profil.
  const langButton = <div className="hs-lang" role="group" aria-label={t.language}>{['en', 'fr'].map(l => <button key={l} type="button" lang={l} aria-pressed={lang === l} aria-label={t.langNames[l]} title={t.langNames[l]} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div>;
  // Bouton de profil : liste déroulante vacancier / particulier / entreprise (+ déconnexion si connecté).
  const pickProfile = id => { choose(id); setProfileOpen(false); profileBtn.current?.focus(); };
  const optionKey = (e, id) => {
    const opts = [...profileMenu.current.querySelectorAll('[role=option]')], i = opts.indexOf(e.currentTarget);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); opts[(i + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length].focus(); }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); opts[e.key === 'Home' ? 0 : opts.length - 1].focus(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickProfile(id); }
    if (e.key === 'Tab') setProfileOpen(false);
  };
  const profileButton = <div className="hs-profile">
    <button ref={profileBtn} type="button" className="hs-profile-btn" aria-haspopup="listbox" aria-expanded={profileOpen} aria-label={`${t.profileMenu} : ${t.profiles[profile]}`} onClick={() => setProfileOpen(o => !o)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setProfileOpen(true); } }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
      <span className="hs-profile-text"><strong><span className="hs-profile-long">{t.profiles[profile]}</span><span className="hs-profile-short">{t.profilesShort[profile]}</span></strong></span>
      <svg className="hs-profile-caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
    </button>
    {profileOpen && <div className="hs-profile-menu" ref={profileMenu}><ul role="listbox" aria-label={t.profileMenu}>{PROFILES.map(id => <li key={id} role="option" tabIndex={-1} aria-selected={profile === id} className={`hs-profile-opt-${id}`} onClick={() => pickProfile(id)} onKeyDown={e => optionKey(e, id)}><i aria-hidden="true">{profileIcon(id, 15)}</i>{t.profiles[id]}{profile === id && <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}</li>)}</ul></div>}
  </div>;
  const fav = a => likes.find(l => l.annonce_id === a.id_source);
  const openFavourites = () => { setView('favourites'); setFavorites(true); setTab('results'); };
  // Bouton Favoris posé en bas à droite de la carte.
  const favFab = <button className={`hs-fav-fab${view === 'favourites' ? ' active' : ''}`} aria-label={`${t.favourites} (${likes.length})`} title={t.favourites} onClick={openFavourites}>{ICONS.favourites}{likes.length > 0 && <span className="hs-fav-count" aria-hidden="true">{likes.length}</span>}</button>;
  const inCompare = a => compare.some(c => c.id_source === a.id_source);
  const toggleCompare = a => setCompare(c => (inCompare(a) ? c.filter(x => x.id_source !== a.id_source) : c.length >= COMPARE_MAX ? c : [...c, a]));
  // « Poser une question » : la conversation s'ouvre, la question est déjà commencée.
  const ask = a => {
    const text = t.askPrefix(a.titre || a.type || t.home1);
    if (window.matchMedia('(max-width: 800px)').matches) setSelected(null);
    setInput(text); setView('messages'); setTab('chat');
    setTimeout(() => { const f = document.getElementById('hs-request'); if (f) { f.focus(); f.setSelectionRange(text.length, text.length); } }, 0);
  };
  const showStrip = view !== 'analysis' && (visible.length > 0 || compare.length > 0);
  const strip = showStrip && <div className="hs-strip" role="region" aria-label={t.stripLabel(visible.length)}>
    <div className="hs-strip-tools">{compare.length > 0 && <button className="hs-strip-compare" onClick={() => setCompareOpen(true)}>{t.compareCount(compare.length)}</button>}{searchId && !favorites && <button className="hs-strip-refresh" onClick={() => loadResults(searchId)}>{t.refresh}</button>}</div>
    <div className="hs-strip-row">{visible.map(a => <article className={`hs-list-card ${selected?.id_source === a.id_source ? 'selected' : ''}`} key={a.id_source}><button className="hs-open" onClick={() => setSelected(a)}>{a.photos?.[0] ? <img src={a.photos[0]} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span className="hs-photo-placeholder">HomeSync</span>}<div><strong>{price(a.prix)}{a.unite_prix === 'nuit' && <span className="hs-per-night">{t.perNightShort}</span>}</strong><small>{a.unite_prix === 'nuit' ? t.pricePerNight : t.purchasePrice}</small><h3>{a.titre || a.type || t.home1}</h3><p>{a.ville || t.cityTbc} · {a.unite_prix === 'nuit' ? t.guests(a.voyageurs) : a.surface == null ? t.surfaceTbc : `${a.surface} m²`}</p>{a.match && <span className="hs-score">Matching {a.match.score}/100</span>}</div></button><button className={`hs-like${fav(a) ? ' on' : ''}${fav(a)?.type === 'gold' ? ' gold' : ''}`} onClick={() => toggleLike(a)} aria-pressed={!!fav(a)} aria-label={fav(a) ? t.editFavourite : t.addFavourite}>{fav(a)?.type === 'gold' ? 'Gold' : <svg width="16" height="16" viewBox="0 0 24 24" fill={fav(a) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9Z" /></svg>}</button></article>)}</div>
  </div>;

  if (!started) return <div className="hs hs-landing"><header>{brand}<div className="hs-header-right">{langButton}</div></header><main className="hs-hero"><span className="hs-kicker">{t.kicker}</span><h1>{t.heroBefore}<em>{t.heroEm}</em></h1><p>{t.heroText}</p><div className="hs-profiles">{[['holiday', 'holidayEyebrow', 'holidayTitle', 'holidayText', 'holidayStart'], ['perso', 'startEyebrow', 'startTitle', 'startText', 'start'], ['pro', 'proEyebrow', 'proTitle', 'proText', 'proStart']].map(([id, eyebrow, title, text, cta]) => <article className={`hs-start hs-start-${id}`} key={id}><div className="hs-start-head"><span className="hs-pastille">{profileIcon(id, 22)}</span><div><span className="hs-kicker">{t[eyebrow]}</span><h2>{t[title]}</h2></div></div><p>{t[text]}</p><button onClick={() => { choose(id); setStarted(true); formTs.current = Date.now(); }}>{t[cta]}</button></article>)}</div></main></div>;

  return <div className={`hs hs-app hs-profile-${profile}`}><header>{brand}<nav className="hs-main-nav" aria-label={t.mainNav}>{[
      ['search', t.search, () => { setView('search'); setFavorites(false); setTab('results'); }],
      ['messages', t.messages, () => { setView('messages'); setTab('chat'); setTimeout(() => document.getElementById('hs-request')?.focus(), 0); }],
      ['analysis', t.analysis, () => { setView('analysis'); setFavorites(false); setTab('results'); }],
    ].map(([key, label, go]) => <button key={key} className={`hs-nav-${key}${view === key ? ' active' : ''}`} aria-current={view === key ? 'page' : undefined} onClick={go}>{ICONS[key]}<span>{label}</span></button>)}</nav><div className="hs-header-right">{langButton}{profileButton}</div></header>
    {tab === 'results' && <button className="hs-chat-fab" aria-label={t.openChat} onClick={() => setTab('chat')}><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-4.5 3.6A.9.9 0 0 1 2 20.9V5a2 2 0 0 1 2-2Zm3 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg></button>}
    {error && <p className="hs-alert" role="alert">{error}</p>}
    <main className="hs-workspace"><section className={`hs-results ${tab === 'results' ? 'mobile-active' : ''}${showStrip ? ' hs-has-strip' : ''}${selected ? ' hs-has-detail' : ''}`} aria-label={t.results}><ConnectedMap t={t} annonces={visible} selected={selected} focus={mapFocus} padding={{ left: selected ? 400 : 0, bottom: showStrip ? 132 : 0 }} onSelect={id => setSelected(visible.find(a => a.id_source === id))} />{view === 'analysis' && analysisPanel}{strip}{favFab}
      {selected && <ListingPanel listing={selected} lang={lang} favouriteType={fav(selected)?.type || null} busy={false}
        onClose={() => setSelected(null)} onToggleFavourite={type => toggleLike(selected, type)}
        inCompare={inCompare(selected)} compareCount={compare.length} compareMax={COMPARE_MAX}
        onToggleCompare={() => toggleCompare(selected)} onAsk={() => ask(selected)} />}</section>
    <section className={`hs-chat ${tab === 'chat' ? 'mobile-active' : ''}`} aria-label={t.conversation}><div className="hs-chat-title"><button className="hs-chat-back" onClick={() => setTab('results')}>{t.backToMap(visible.length)}</button>{profile === 'holiday' && <p className="hs-holiday-note" role="note"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg><span>{t.holidayNote} <a href="https://insideairbnb.com/" target="_blank" rel="noreferrer">Inside Airbnb</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></span></p>}<span className="hs-kicker">{t.assistantKicker}</span><h2>{t.chatTitle}</h2><p>{t.chatText}</p></div><div className="hs-messages" aria-live="polite">{messages.map((m, i) => <div className={`hs-message ${m.role}`} key={i}>{m.key ? t[m.key === 'greeting' ? GREETING[profile] : m.key] : m.text}</div>)}{busy && <p role="status">{t.searching}</p>}{preview && <div className="hs-preview"><strong>{t.previewTitle(preview.count)}</strong>{preview.prix_min != null && <p>{preview.unite_prix === 'nuit' ? t.previewRangeNight(price(preview.prix_min), price(preview.prix_max)) : t.previewRange(price(preview.prix_min), price(preview.prix_max))}</p>}<button onClick={() => loadResults(searchId)}>{t.seeHomes}</button></div>}<div ref={bottom} /></div>
    {choice?.options?.length > 0 && <div className="hs-choices"><p>{t.chooseCities(choice.max || 3)}</p>{choice.options.map(v => <button key={v} aria-pressed={cities.includes(v)} disabled={busy || (!cities.includes(v) && cities.length >= (choice.max || 3))} onClick={() => setCities(c => c.includes(v) ? c.filter(x => x !== v) : [...c, v])}>{v}</button>)}<button disabled={!cities.length || busy} onClick={() => send(cities.join(', '))}>{t.confirmCities}</button></div>}
    {!choice && <div className="hs-choices">{suggestions.map(s => <button key={s} disabled={busy} onClick={() => profile !== 'holiday' && s === 'Affiner ma recherche' ? (setInput(''), setMessages(m => [...m, { role: 'assistant', key: 'refine' }])) : send(s)}>{s}</button>)}</div>}
    <form className="hs-compose" onSubmit={e => { e.preventDefault(); send(input); }}><label htmlFor="hs-request" className="hs-sr">{t.yourRequest}</label><div className="hs-compose-box"><textarea id="hs-request" rows={1} maxLength={1000} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }} enterKeyHint="send" placeholder={profile === 'holiday' ? t.placeholderHoliday : t.placeholder} required /><MicButton lang={lang} value={input} onChange={setInput} onErreur={setMicInfo} /><button type="submit" className="hs-send" aria-label={t.sendLabel} title={t.sendLabel} disabled={busy || !input.trim() || input.length > 1000}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg></button></div>{micInfo && <small role="status" className="hs-mic-info">{micInfo}</small>}<small>{t.noPersonal}</small></form></section></main>
    {compareOpen && <CompareTable lang={lang} listings={compare.map(c => annonces.find(a => a.id_source === c.id_source) || c)}
      onRemove={id => setCompare(c => c.filter(x => x.id_source !== id))} onClose={() => setCompareOpen(false)}
      onOpen={a => { setCompareOpen(false); setTab('results'); setSelected(annonces.find(x => x.id_source === a.id_source) || a); }} />}
  </div>;
}
