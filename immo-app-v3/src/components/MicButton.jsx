import { useEffect, useRef, useState } from 'react';

/* ── Micro : dictée par la reconnaissance vocale du navigateur ──
   Le texte s'écrit dans le champ pendant qu'on parle (ajouté à ce qui y est
   déjà) ; rien n'est envoyé tant que l'utilisateur ne valide pas. Aucun audio
   ne transite par notre serveur. Bouton masqué si le navigateur ne gère pas
   la dictée (Firefox). */

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

const ERREURS = {
  'not-allowed': 'Micro refusé : autorisez-le dans les réglages du navigateur.',
  'service-not-allowed': 'Micro refusé : autorisez-le dans les réglages du navigateur.',
  'audio-capture': 'Aucun micro détecté.',
  network: 'La dictée nécessite une connexion internet.',
};

export default function MicButton({ value, onChange, onErreur = () => {} }) {
  const [ecoute, setEcoute] = useState(false);
  const recRef = useRef(null);

  useEffect(() => () => recRef.current?.abort(), []);

  if (!SpeechRecognition) return null;

  const toggle = () => {
    if (ecoute) {
      recRef.current?.stop();
      return;
    }
    const base = value.trim();
    const rec = new SpeechRecognition();
    rec.lang = 'fr-FR';
    rec.interimResults = true; // affichage en direct pendant qu'on parle
    rec.continuous = false;    // s'arrête seul après une pause
    rec.onstart = () => { setEcoute(true); onErreur(''); };
    rec.onend = () => setEcoute(false);
    rec.onerror = (e) => onErreur(ERREURS[e.error] || (e.error === 'no-speech' ? "Je n'ai rien entendu, réessayez." : ''));
    rec.onresult = (e) => {
      const dicte = Array.from(e.results, r => r[0].transcript).join('').trim();
      onChange(base ? `${base} ${dicte}` : dicte);
    };
    recRef.current = rec;
    rec.start();
  };

  return (
    <button
      type="button"
      className={`chat-mic-btn${ecoute ? ' active' : ''}`}
      aria-label={ecoute ? 'Arrêter la dictée' : 'Dicter mon message'}
      title={ecoute ? 'Arrêter la dictée' : 'Dicter mon message'}
      onClick={toggle}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v5" />
      </svg>
    </button>
  );
}
