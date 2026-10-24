import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorText, getToken, setToken } from '../api';
import MicButton from './MicButton';
import './ChatAgent.css';

/* ── Agent de recherche : le chat filtre les annonces (RAG), puis propose de
   créer un compte pour les découvrir en mode swipe. La conversation est
   conservée dans le navigateur pour reprendre après la vérification de l'email. ── */

const STORAGE_KEY = 'immo_chat';

const fmtPrix = (n) => (n ? `${Math.round(n).toLocaleString('fr-FR')} €` : 'N/C');

const loadSaved = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
};

const newSessionId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

export default function ChatAgent() {
  const saved = loadSaved();
  const navigate = useNavigate();

  const [chatActive, setChatActive] = useState(Boolean(saved?.messages?.length));
  const [messages, setMessages] = useState(saved?.messages || []);
  const [resultats, setResultats] = useState(saved?.resultats || null);
  const [sessionId, setSessionId] = useState(saved?.sessionId || newSessionId());
  const [chatInput, setChatInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [choix, setChoix] = useState(saved?.choix || null); // { type: 'villes', options, max }
  const [villesChoisies, setVillesChoisies] = useState([]);
  const [agentTyping, setAgentTyping] = useState(false);
  const [rgpdConsent, setRgpdConsent] = useState(Boolean(saved?.messages?.length));
  const [consentShake, setConsentShake] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [formTs] = useState(() => Date.now());
  const [micInfo, setMicInfo] = useState('');

  // Compte
  const [authMode, setAuthMode] = useState(saved?.authMode || null); // null | 'register' | 'login'
  const [form, setForm] = useState({ nom: '', email: saved?.email || '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [devLien, setDevLien] = useState('');
  const [compte, setCompte] = useState(null);

  const messagesRef = useRef(null);

  // Persistance de la conversation (reprise après vérification de l'email)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, messages, resultats, choix, authMode, email: form.email }));
    } catch { /* stockage indisponible */ }
  }, [sessionId, messages, resultats, choix, authMode, form.email]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, agentTyping, authMode, choix]);

  // Session déjà ouverte : pas de formulaire de compte
  useEffect(() => {
    if (!getToken()) return;
    api('/api/auth/me').then(r => {
      if (!r.ok) return;
      setCompte(r.data);
      setAuthMode(null);
    });
  }, []);

  // Les boutons de compte restent sur le dernier aperçu, même après d'autres messages
  const dernierApercu = messages.reduce((idx, m, i) => (m.apercu ? i : idx), -1);

  const addMsg = (role, text, extra = {}) => setMessages(m => [...m, { role, text, ...extra }]);

  const callAgent = async (text) => {
    setAgentTyping(true);
    const r = await api('/api/chat', { method: 'POST', body: { message: text, sessionId, honeypot, formTs } });
    setAgentTyping(false);
    if (!r.ok) {
      addMsg('agent', errorText(r.data, "Je n'arrive pas à joindre le serveur. Réessayez dans un instant."));
      return;
    }
    const { reply, suggestions: sugg, resultats: res, choix: ch } = r.data;
    addMsg('agent', reply, res ? { apercu: res } : {});
    setSuggestions(sugg || []);
    setChoix(ch || null);
    setVillesChoisies([]);
    if (res) setResultats(res);
  };

  const openChat = () => {
    if (!rgpdConsent) {
      setConsentShake(true);
      setTimeout(() => setConsentShake(false), 600);
      return;
    }
    const query = chatInput.trim() || 'Bonjour';
    setChatActive(true);
    setChatInput('');
    addMsg('user', query);
    callAgent(query);
  };

  const sendChat = (forced) => {
    const text = (forced ?? chatInput).trim();
    if (!text || agentTyping) return;
    addMsg('user', text);
    setChatInput('');
    setSuggestions([]);
    callAgent(text);
  };

  const onQuick = (q) => {
    if (q === 'Affiner ma recherche') {
      addMsg('agent', 'Précisez ce que vous voulez changer : villes, quartier, budget, surface, nombre de pièces…');
      setSuggestions([]);
      return;
    }
    sendChat(q);
  };

  const toggleVille = (ville) => setVillesChoisies(list =>
    list.includes(ville) ? list.filter(v => v !== ville) : list.length < choix.max ? [...list, ville] : list);

  const resetChat = () => {
    setMessages([]);
    setResultats(null);
    setSuggestions([]);
    setChoix(null);
    setAuthMode(null);
    setSessionId(newSessionId());
    setChatActive(false);
  };

  // ── Compte ──
  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthError('');
  };

  const submitAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    if (authMode === 'register') {
      const r = await api('/api/auth/register', { method: 'POST', auth: false, body: form });
      setAuthBusy(false);
      if (!r.ok) return setAuthError(errorText(r.data));
      setDevLien(r.data.dev_lien || '');
      addMsg('agent', `Votre compte est créé ! Un email de vérification a été envoyé à ${form.email}. Cliquez sur le lien qu'il contient, puis connectez-vous ici pour découvrir vos annonces.`);
      setForm(f => ({ ...f, password: '' }));
      setAuthMode('login');
      return;
    }
    const r = await api('/api/auth/login', { method: 'POST', auth: false, body: { email: form.email, password: form.password } });
    setAuthBusy(false);
    if (!r.ok) return setAuthError(errorText(r.data));
    setToken(r.data.access_token);
    setCompte(r.data.user);
    setAuthMode(null);
    setForm(f => ({ ...f, password: '' }));
    addMsg('agent', `Bienvenue${r.data.user.nom ? ` ${r.data.user.nom}` : ''} ! Vos annonces vous attendent : swipez à droite pour liker, à gauche pour passer.`);
  };

  const resendVerification = async () => {
    const r = await api('/api/auth/resend-verification', { method: 'POST', auth: false, body: { email: form.email } });
    if (r.data?.dev_lien) setDevLien(r.data.dev_lien);
    setAuthError(r.ok ? 'Nouveau lien envoyé, vérifiez votre boîte mail.' : errorText(r.data));
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setToken(null);
    setCompte(null);
  };

  // ── Rendu ──
  if (!chatActive) {
    return (
      <div className="chat-launch-card">
        <p className="chat-launch-title">Décrivez votre projet à notre assistant IA</p>
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="chat-honeypot"
          value={honeypot}
          onChange={e => setHoneypot(e.target.value)}
          autoComplete="off"
          name="website"
        />
        <div className="chat-launch-input">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); openChat(); } }}
            placeholder="Ex : T3 à Lyon ou Nantes avec terrasse, budget 300 000 €"
            maxLength={1000}
          />
          <MicButton value={chatInput} onChange={setChatInput} onErreur={setMicInfo} />
          <button className="chat-go-btn" onClick={openChat} aria-label="Lancer l'assistant" disabled={!rgpdConsent}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
            </svg>
          </button>
        </div>
        {micInfo && <p className="chat-mic-info">{micInfo}</p>}
        <label className={`chat-consent${consentShake ? ' chat-shake' : ''}`}>
          <input type="checkbox" checked={rgpdConsent} onChange={e => setRgpdConsent(e.target.checked)} />
          <span>J'accepte que mes messages soient traités pour rechercher des annonces correspondant à ma demande. Ne partagez pas de coordonnées dans le chat.</span>
        </label>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div>
          <strong>Assistant immobilier</strong>
          <p>{compte ? `Connecté : ${compte.email}` : 'Je filtre les annonces de France selon votre demande.'}</p>
        </div>
        <div className="chat-header-actions">
          {compte && <button type="button" className="chat-link-btn" onClick={logout}>Déconnexion</button>}
          <button type="button" className="chat-close" onClick={resetChat}>Nouvelle recherche</button>
        </div>
      </div>

      <div className="chat-messages" ref={messagesRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-message ${m.role}`}>
            <p>{m.text}</p>
            {m.apercu && i === dernierApercu && (
              <div className="chat-apercu">
                <div className="chat-apercu-head">
                  <span className="chat-apercu-count">{m.apercu.count}</span>
                  <span>annonce{m.apercu.count > 1 ? 's' : ''} · de {fmtPrix(m.apercu.prix_min)} à {fmtPrix(m.apercu.prix_max)}</span>
                </div>
                {m.apercu.items.map((it, j) => (
                  <div key={j} className="chat-apercu-item">
                    <span>{it.type}</span>
                    <span>{it.ville}</span>
                    <span className="chat-blur">{it.quartier} · {Math.round(it.surface || 0)} m²</span>
                  </div>
                ))}
                {compte ? (
                  <div className="chat-cta-row">
                    <button type="button" className="chat-cta" onClick={() => navigate(`/decouvrir/${m.apercu.search_id}`)}>
                      Découvrir les {m.apercu.count} annonces ❤
                    </button>
                  </div>
                ) : !authMode && (
                  <div className="chat-cta-row">
                    <button type="button" className="chat-cta" onClick={() => openAuth('register')}>Créer mon compte gratuit</button>
                    <button type="button" className="chat-cta secondary" onClick={() => openAuth('login')}>J'ai déjà un compte</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {agentTyping && (
          <div className="chat-message agent">
            <div className="chat-typing"><span /><span /><span /></div>
          </div>
        )}

        {choix?.type === 'villes' && !agentTyping && (
          <div className="chat-choix">
            <div className="chat-choix-options">
              {choix.options.map(v => (
                <button key={v} type="button" onClick={() => toggleVille(v)}
                  className={`chat-quick${villesChoisies.includes(v) ? ' selected' : ''}`}
                  disabled={!villesChoisies.includes(v) && villesChoisies.length >= choix.max}>
                  {v}
                </button>
              ))}
            </div>
            <button type="button" className="chat-cta" disabled={!villesChoisies.length} onClick={() => sendChat(villesChoisies.join(', '))}>
              Valider {villesChoisies.length ? `(${villesChoisies.length}/${choix.max})` : `— ${choix.max} villes max`}
            </button>
          </div>
        )}

        {authMode && !compte && (
          <form className="chat-auth" onSubmit={submitAuth}>
            <p className="chat-auth-title">{authMode === 'register' ? 'Créer votre compte' : 'Connexion'}</p>
            {authMode === 'register' && (
              <input placeholder="Prénom" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} autoComplete="given-name" />
            )}
            <input type="email" required placeholder="Adresse email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" />
            <input type="password" required placeholder="Mot de passe" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} />
            {authMode === 'register' && <span className="chat-auth-hint">10 caractères minimum, avec une majuscule, une minuscule et un chiffre.</span>}
            {authError && <span className="chat-auth-error">{authError}</span>}
            {authError.includes('non vérifiée') && (
              <button type="button" className="chat-link-btn" onClick={resendVerification}>Renvoyer l'email de vérification</button>
            )}
            {devLien && (
              <a className="chat-dev-link" href={devLien} target="_blank" rel="noreferrer">Mode dev : ouvrir le lien de vérification</a>
            )}
            <button type="submit" className="chat-cta" disabled={authBusy}>
              {authBusy ? '…' : authMode === 'register' ? 'Créer mon compte' : 'Se connecter'}
            </button>
            <button type="button" className="chat-link-btn" onClick={() => openAuth(authMode === 'register' ? 'login' : 'register')}>
              {authMode === 'register' ? "J'ai déjà un compte" : 'Créer un compte'}
            </button>
          </form>
        )}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
          placeholder="Écrivez votre message…"
          maxLength={1000}
        />
        <MicButton value={chatInput} onChange={setChatInput} onErreur={setMicInfo} />
        <button type="button" className="chat-send-btn" onClick={() => sendChat()} aria-label="Envoyer" disabled={agentTyping}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
          </svg>
        </button>
      </div>

      {micInfo && <p className="chat-mic-info chat-mic-info-panel">{micInfo}</p>}

      {suggestions.length > 0 && (
        <div className="chat-quicks">
          {suggestions.map(q => (
            <button key={q} type="button" className="chat-quick" onClick={() => onQuick(q)}>{q}</button>
          ))}
        </div>
      )}
    </div>
  );
}
