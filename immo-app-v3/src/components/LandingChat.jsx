import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, QUARTIERS_TOULON, computeScoreDetailed } from '../context/AppContext';
import { fetchChatSearchResults, searchNationalProperties, sendChatMessage } from '../services/api';
import './LandingChat.css';

const QUICK_PROMPTS = [
  { label: 'T3 au Mourillon avec balcon (< 280k€)', text: 'Je cherche un T3 lumineux au Mourillon avec balcon pour maximum 280 000 €.' },
  { label: 'Investissement locatif rentable (< 140k€)', text: 'Je veux un appartement rentable à Nantes sous 140 000 € pour du locatif.' },
  { label: 'Maison familiale avec jardin', text: 'Je recherche une maison ou grand bien avec jardin au calme pour 450 000 €.' },
  { label: 'Studio / T2 Centre-Ville (< 120k€)', text: 'Un studio ou T2 en Centre-Ville ou Haute-Ville pour moins de 120 000 €.' },
];

export default function LandingChat({
  onQuartierSelect = () => {},
  onSearchUpdate = () => {},
  onLaunchMatching = null,
  coUsers = [],
  onOpenInvite = null,
  onOpenContactAgency = null,
}) {
  const { profil, setProfil, annonces, setAnnonces, setActiveSearch, setUser } = useApp();
  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const addedCollabRef = useRef(false);
  const formStartedAt = useRef(Date.now() - 2500);
  const sessionIdRef = useRef(localStorage.getItem('homesync_chat_session') || null);

  // Initial greeting
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "Bonjour Marc Ivan. Décrivez votre projet comme à un ami : ville, type de bien, budget, quartier, ce qui est indispensable et ce qui serait un plus. Je m'occupe de la carte et de vos correspondances prioritaires.",
      timestamp: 'À l\'instant',
    },
  ]);

  // Handle co-user arrival (Alex)
  useEffect(() => {
    if (coUsers.length > 0 && !addedCollabRef.current) {
      addedCollabRef.current = true;
      const co = coUsers[0];

      setTimeout(() => {
        const sysMsg = {
          id: Date.now() + 10,
          sender: 'system',
          text: `${co.name} a rejoint la recherche, sur invitation de Marc Ivan`,
          timestamp: 'À l\'instant',
        };
        const coMsg = {
          id: Date.now() + 20,
          sender: 'collab',
          senderName: co.name,
          text: "Bonjour ! Je travaille à l'Arsenal / Port : moins de 20 minutes de trajet, s'il vous plaît. Idéalement moins de 15 min à pied ou vélo.",
          timestamp: 'À l\'instant',
        };
        const aiAck = {
          id: Date.now() + 30,
          sender: 'ai',
          text: `Je note pour ${co.name} :\n• **Indispensable :** ≤ 20 min max jusqu'au Port / Arsenal\n• **Souhaité :** 15 min ou moins\n\n**La zone prioritaire** a été mise à jour : Le Mourillon et Le Port offrent le meilleur terrain d'entente pour vous deux.`,
          timestamp: 'À l\'instant',
        };
        setMessages(prev => [...prev, sysMsg, coMsg, aiAck]);
      }, 500);
    }
  }, [coUsers]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Natural Language Intent Parser
  const parseUserIntent = (text) => {
    const lower = text.toLowerCase();
    const newCriteria = { ...profil };

    // 1. Budget extraction
    // Match "280 000", "280000", "280k", "280 k€", "350 000 €"
    const budgetKMatch = lower.match(/(\d+)\s*(?:k€?|k\b|000)/i);
    const budgetFullMatch = lower.match(/(\d[\d\s]{2,8})\s*(?:€|euros?)/i);
    if (budgetFullMatch) {
      const cleanNum = Number(budgetFullMatch[1].replace(/\s/g, ''));
      if (cleanNum > 10000) newCriteria.prixMax = cleanNum;
    } else if (budgetKMatch) {
      const num = Number(budgetKMatch[1]);
      newCriteria.prixMax = num < 2000 ? num * 1000 : num;
    }

    // 2. Type de bien
    if (lower.includes('maison') || lower.includes('villa')) {
      newCriteria.typeBien = 'Maison';
    } else if (lower.includes('appartement') || lower.includes('studio') || lower.includes('duplex') || lower.includes('loft')) {
      newCriteria.typeBien = 'Appartement';
    }

    // 3. Number of rooms
    if (lower.includes('studio') || lower.includes('t1') || lower.includes('1 pièce')) {
      newCriteria.pieces = 1;
    } else if (lower.includes('t2') || lower.includes('2 pièces') || lower.includes('deux pièces')) {
      newCriteria.pieces = 2;
    } else if (lower.includes('t3') || lower.includes('3 pièces') || lower.includes('trois pièces')) {
      newCriteria.pieces = 3;
    } else if (lower.includes('t4') || lower.includes('4 pièces') || lower.includes('quatre pièces')) {
      newCriteria.pieces = 4;
    } else if (lower.includes('t5') || lower.includes('5 pièces') || lower.includes('cinq pièces')) {
      newCriteria.pieces = 5;
    }

    // 4. District extraction (match any of the 43 Toulon neighborhoods)
    const matchedDistricts = [];
    QUARTIERS_TOULON.forEach(q => {
      const qLower = q.toLowerCase();
      // Test key name tokens
      if (lower.includes(qLower)) {
        matchedDistricts.push(q);
      } else if (qLower.includes('mourillon') && lower.includes('mourillon')) {
        matchedDistricts.push(q);
      } else if (qLower.includes('cap brun') && (lower.includes('cap brun') || lower.includes('cap-brun'))) {
        matchedDistricts.push(q);
      } else if (qLower.includes('saint-roch') && (lower.includes('saint roch') || lower.includes('st roch'))) {
        matchedDistricts.push(q);
      } else if (qLower.includes('haute-ville') && (lower.includes('haute ville') || lower.includes('haute-ville'))) {
        matchedDistricts.push(q);
      } else if (qLower.includes('centre-ville') && (lower.includes('centre ville') || lower.includes('centre-ville') || lower.includes('centre'))) {
        matchedDistricts.push(q);
      }
    });

    if (matchedDistricts.length > 0) {
      newCriteria.quartiers = Array.from(new Set(matchedDistricts));
    }

    return newCriteria;
  };

  const handleSend = async (textToSend = input) => {
    const text = textToSend.trim();
    if (!text) return;

    // Add user message
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text,
      timestamp: 'À l\'instant',
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Ensure user session exists
    setUser(prev => ({
      ...prev,
      nom: prev?.nom || 'Marc Ivan',
      email: prev?.email || 'mariojaris2@gmail.com',
      profil: 'Acheteur',
    }));

    try {
      const response = await sendChatMessage({ message: text, sessionId: sessionIdRef.current, formTs: formStartedAt.current });
      sessionIdRef.current = response.sessionId || sessionIdRef.current;
      if (sessionIdRef.current) localStorage.setItem('homesync_chat_session', sessionIdRef.current);
      const slots = response.slots || {};
      const updatedProfil = {
        ...profil,
        pieces: slots.pieces || profil.pieces,
        prixMax: slots.budget_max || profil.prixMax,
        typeBien: slots.type_bien || profil.typeBien,
        quartiers: slots.quartiers?.length ? slots.quartiers : (slots.villes?.length ? slots.villes : profil.quartiers),
      };
      setProfil(updatedProfil);
      onSearchUpdate(updatedProfil);
      const area = slots.villes?.[0] || slots.quartiers?.[0];
      if (area) onQuartierSelect(area);
      const searchQuery = [
        text,
        slots.villes?.length && `villes : ${slots.villes.join(', ')}`,
        slots.quartiers?.length && `secteurs : ${slots.quartiers.join(', ')}`,
        slots.type_bien && `type : ${slots.type_bien}`,
        slots.pieces && `${slots.pieces} pièces`,
        slots.budget_max && `budget maximum ${slots.budget_max} euros`,
      ].filter(Boolean).join(' · ');

      // A verified conversation exposes its exact scored result set. For public
      // searches, use the same words the visitor typed against the national index.
      let nationalResults = [];
      const searchId = response.resultats?.search_id;
      try {
        const chatResults = await fetchChatSearchResults(searchId);
        nationalResults = chatResults?.annonces || [];
      } catch { /* An unfinished/public session falls back to semantic search. */ }
      if (!nationalResults.length) {
        try { nationalResults = await searchNationalProperties(searchQuery, 50); } catch { /* conversation remains usable */ }
      }
      if (nationalResults.length) setAnnonces(nationalResults);
      const matchCount = response.resultats?.count || nationalResults.length || annonces.length;
      const topMatch = nationalResults[0] || annonces[0];
      setActiveSearch({
        query: searchQuery,
        searchId: searchId || null,
        resultCount: nationalResults.length || response.resultats?.count || 0,
        location: area || null,
        updatedAt: Date.now(),
      });
      setMessages(prev => [...prev, {
        id: Date.now() + 1, sender: 'ai', text: response.reply || 'Votre recherche a été mise à jour.',
        actionCard: { matchCount, topMatch, profil: updatedProfil }, timestamp: 'À l’instant',
      }]);
    } catch {
      // Keep a local fallback only when the backend cannot be reached.
      const updatedProfil = parseUserIntent(text);
      setProfil(updatedProfil);
      onSearchUpdate(updatedProfil);
      const primaryDistrict = updatedProfil.quartiers?.[0];
      if (primaryDistrict) onQuartierSelect(primaryDistrict);
      const matchingProps = annonces.filter(p => computeScoreDetailed(p, updatedProfil).total >= 65);
      setActiveSearch({ query: text, resultCount: matchingProps.length, location: primaryDistrict || null, updatedAt: Date.now(), fallback: true });
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'Le service de recherche est momentanément indisponible. Les résultats locaux ont été mis à jour.', actionCard: { matchCount: matchingProps.length || annonces.length, topMatch: matchingProps[0] || annonces[0], profil: updatedProfil }, timestamp: 'À l’instant' }]);
    } finally {
      setIsTyping(false);
    }
    /*
     * Historical local demo kept below as documentation of the former parser.
     * It is unreachable now: the live backend response above is authoritative.
     */
    /* setTimeout(() => {
      const updatedProfil = parseUserIntent(text);
      setProfil(updatedProfil);

      // Notify parent map
      onSearchUpdate(updatedProfil);
      const primaryDistrict = updatedProfil.quartiers?.[0];
      if (primaryDistrict) {
        onQuartierSelect(primaryDistrict);
      }

      // Compute matching statistics against the active properties
      const matchingProps = annonces.filter(p => {
        const { total } = computeScoreDetailed(p, updatedProfil);
        return total >= 65;
      });

      const topMatch = matchingProps[0] || annonces[0];
      const matchCount = matchingProps.length;

      // Extract market data for district if found
      let districtInsight = '';
      if (primaryDistrict && marketDashboard?.QUARTIERS) {
        const qData = marketDashboard.QUARTIERS.find(
          q => q.nom.toLowerCase().includes(primaryDistrict.toLowerCase())
        );
        if (qData) {
          districtInsight = `\n\n*Repère marché : À ${primaryDistrict}, le prix moyen est de ${qData.moy?.toLocaleString('fr-FR')} €/m² avec ${qData.vol} transactions récentes.*`;
        }
      }

      const mapNotice = primaryDistrict
        ? `\n\n**Carte synchronisée :** zoom automatique sur **${primaryDistrict}** avec vos correspondances prioritaires mises en avant.`
        : `\n\n**Carte interactive :** vos correspondances prioritaires sont mises en avant sur Toulon.`;

      const aiReply = {
        id: Date.now() + 1,
        sender: 'ai',
        text: `Parfait, vos critères ont été calibrés.\n\n**Critères retenus :**\n• Type : ${updatedProfil.typeBien}\n• Pièces : ${updatedProfil.pieces} pièces (T${updatedProfil.pieces})\n• Budget max : ${updatedProfil.prixMax?.toLocaleString('fr-FR')} €\n• Quartier : ${updatedProfil.quartiers?.length ? updatedProfil.quartiers.join(', ') : 'Tout Toulon'}${districtInsight}${mapNotice}\n\n**${matchCount} biens prioritaires** correspondent précisément à votre recherche.`,
        actionCard: {
          matchCount: matchCount || annonces.length,
          topMatch,
          profil: updatedProfil,
        },
        timestamp: 'À l\'instant',
      };

      setMessages(prev => [...prev, aiReply]);
      setIsTyping(false);
    }, 600); */
  };

  const handleLaunchMatchingAction = (targetTab = 'tinder') => {
    setUser(prev => ({
      ...prev,
      nom: prev?.nom || 'Marc Ivan',
      email: prev?.email || 'mariojaris2@gmail.com',
      profil: 'Acheteur',
    }));

    if (onLaunchMatching) {
      onLaunchMatching(targetTab);
    } else {
      navigate(`/accueil?tab=${targetTab}`);
    }
  };

  return (
    <div className="landing-chat-card">
      {/* ── CHAT HEADER ── */}
      <div className="chat-card-header">
        <div className="chat-header-agent">
          <div className="agent-avatar-wrap">
            <span className="agent-avatar-emoji">T</span>
            <span className="agent-status-dot" />
          </div>
          <div>
            <div className="agent-name">HomeSync Assistant</div>
            <div className="agent-desc">Conseiller immobilier · recherche nationale</div>
          </div>
        </div>

        <button
          className="chat-fast-pass-btn gold-fast-pass"
          onClick={() => handleLaunchMatchingAction('tinder')}
          title="Accéder directement au Tinder Matcher"
        >
          <span>Voir les correspondances</span>
          <span>→</span>
        </button>
      </div>

      {/* ── PRIVACY SUBHEADER (Inspired by Reference) ── */}
      <div className="chat-privacy-subheader">
        <div className="privacy-left">
          <span className="privacy-lock-badge">P</span>
          <div className="privacy-text-wrap">
            <span className="privacy-main-label">Conversation privée</span>
            <span className="privacy-sub-label">
              Marc Ivan{coUsers.length > 0 ? ` & ${coUsers.map(u => u.name).join(', ')}` : ''} et l'assistant IA · jamais transmise aux annonceurs
            </span>
          </div>
        </div>
        {onOpenInvite && (
          <button
            type="button"
            className="chat-invite-pill-btn"
            onClick={onOpenInvite}
            title="Inviter un partenaire ou co-acquéreur"
          >
            + Inviter
          </button>
        )}
      </div>

      {/* ── STRUCTURED COMPREHENSION BOX (Inspired by Reference) ── */}
      <div className="chat-comprehension-box">
        <div className="ccb-header">
          <span className="ccb-icon">i</span>
          <strong>Ce que j'ai compris</strong>
        </div>
        <div className="ccb-line">
          <span className="ccb-tag tag-indispensable">Indispensable :</span>
          <span>T{profil.pieces} · ≤ {profil.prixMax?.toLocaleString('fr-FR')} € · {profil.typeBien}</span>
        </div>
        <div className="ccb-line">
          <span className="ccb-tag tag-souhaite">Souhaité (Marc) :</span>
          <span>{profil.quartiers?.length ? profil.quartiers[0].split('-')[0].trim() : 'Le Mourillon / Cap Brun'} · Balcon / Terrasse</span>
        </div>
        {coUsers.length > 0 && (
          <div className="ccb-line">
            <span className="ccb-tag tag-alex">Souhaité ({coUsers[0].name}) :</span>
            <span>≤ 20 min du Port / Arsenal · Mobilité douce</span>
          </div>
        )}
        <div className="ccb-footer-hint">
          Pour changer un critère, dites-le simplement dans la conversation.
        </div>
      </div>

      {/* ── CHAT MESSAGES STREAM ── */}
      <div className="chat-messages-stream">
        {messages.map(msg => {
          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="chat-system-pill">
                <span>{msg.text}</span>
              </div>
            );
          }

          if (msg.sender === 'collab') {
            return (
              <div key={msg.id} className="chat-bubble-wrap bubble-collab">
                <div className="chat-avatar-mini collab-avatar">
                  {msg.senderName?.[0] || 'A'}
                </div>
                <div className="chat-bubble-content">
                  <span className="collab-name-tag">{msg.senderName} (co-acquéreur)</span>
                  <div className="chat-bubble-text collab-text">{msg.text}</div>
                  <span className="chat-bubble-time">{msg.timestamp}</span>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`chat-bubble-wrap bubble-${msg.sender}`}>
              {msg.sender === 'ai' && (
                <div className="chat-avatar-mini">T</div>
              )}
              <div className="chat-bubble-content">
                {msg.sender === 'user' && (
                  <span className="user-name-tag">Marc Ivan (vous)</span>
                )}
                <div className="chat-bubble-text">
                  {msg.text.split('\n').map((line, idx) => (
                    <span key={idx}>
                      {line}
                      <br />
                    </span>
                  ))}
                </div>

                {/* Action Card inside AI message */}
                {msg.actionCard && (
                  <div className="chat-action-card golden-card">
                    <div className="cac-top">
                      <span className="cac-fire">{msg.actionCard.matchCount}</span>
                      <div>
                        <div className="cac-title">{msg.actionCard.matchCount} opportunités prioritaires</div>
                        <div className="cac-sub">Synchronisées sur la carte interactive</div>
                      </div>
                    </div>

                    <div className="cac-buttons">
                      <button
                        className="cac-btn cac-btn-tinder"
                        onClick={() => handleLaunchMatchingAction('tinder')}
                      >
                        Voir les correspondances ({msg.actionCard.matchCount})
                      </button>
                      <button
                        className="cac-btn cac-btn-map"
                        onClick={() => handleLaunchMatchingAction('carte')}
                      >
                        Explorer la carte
                      </button>
                      {onOpenContactAgency && msg.actionCard.topMatch && (
                        <button
                          className="cac-btn cac-btn-agency"
                          onClick={() => onOpenContactAgency(msg.actionCard.topMatch)}
                        >
                          Préparer une visite
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <span className="chat-bubble-time">{msg.timestamp}</span>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="chat-bubble-wrap bubble-ai">
            <div className="chat-avatar-mini">T</div>
            <div className="chat-typing-dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── QUICK PROMPTS CHIPS ── */}
      <div className="chat-quick-prompts">
        <span className="qp-label">Suggestions rapides :</span>
        <div className="qp-chips-scroll">
          {QUICK_PROMPTS.map((qp, i) => (
            <button
              key={i}
              className="qp-chip"
              onClick={() => handleSend(qp.text)}
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── INPUT BOX WITH VOICE BUTTON (Inspired by Reference) ── */}
      <form
        className="chat-input-bar"
        onSubmit={e => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          type="text"
          className="chat-input-field"
          placeholder="Décrivez ce qui compte pour vous (budget, trajet, extérieur...)..."
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button
          type="button"
          className={`chat-mic-btn ${isRecording ? 'recording' : ''}`}
          onClick={() => {
            setIsRecording(!isRecording);
            if (!isRecording) {
              setInput("On cherche un T3 lumineux au Mourillon ou Cap Brun avec extérieur sous 280 000 €");
              setTimeout(() => setIsRecording(false), 1400);
            }
          }}
          title="Dictée vocale (simulation micro)"
        >
          <span aria-hidden="true">●</span>
        </button>
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!input.trim()}
          title="Envoyer votre message"
        >
          <span>Envoyer</span>
          <span className="send-arrow">➔</span>
        </button>
      </form>
      <div className="chat-footer-author-hint">
        Vous écrivez en tant que Marc Ivan · visible par l'assistant
      </div>
    </div>
  );
}
