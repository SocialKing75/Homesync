import { useMemo, useState } from 'react';
import './InviteModal.css';

export default function InviteModal({ isOpen, onClose, onInviteSuccess }) {
  const [name, setName] = useState('Alex');
  const [copied, setCopied] = useState(false);
  const inviteLink = useMemo(() => {
    const token = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${window.location.origin}/invitation/${token}`;
  }, []);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const handleConfirmInvite = () => {
    if (name.trim()) onInviteSuccess(name.trim());
    onClose();
  };

  return (
    <div className="invite-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="invite-modal-card" role="dialog" aria-modal="true" aria-labelledby="invite-title" onClick={(event) => event.stopPropagation()}>
        <header className="invite-modal-header">
          <div className="invite-title-row">
            <span className="invite-mark" aria-hidden="true">+</span>
            <div>
              <span className="invite-kicker">Projet partagé</span>
              <h2 id="invite-title">Inviter une personne</h2>
            </div>
          </div>
          <button id="btn-close-invite-modal" className="invite-modal-close" onClick={onClose} aria-label="Fermer">×</button>
          <p>Ajoutez un proche, un co-acquéreur ou un colocataire à ce projet. Vous pourrez ensuite affiner la recherche ensemble.</p>
        </header>

        <div className="invite-form-group">
          <label htmlFor="invite-name-input">Prénom</label>
          <input
            id="invite-name-input"
            type="text"
            className="invite-input"
            placeholder="Ex. Alex ou Sarah"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="invite-link-panel">
          <div className="invite-link-heading">
            <div>
              <span>Lien d’invitation</span>
              <small>À partager avec la personne de votre choix</small>
            </div>
            <button type="button" className={`invite-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
              {copied ? 'Lien copié' : 'Copier'}
            </button>
          </div>
          <code>{inviteLink}</code>
        </div>

        <div className="invite-sharing">
          <span className="invite-section-label">Ce qui sera partagé</span>
          <div className="invite-sharing-list">
            <div><strong>Recherche commune</strong><span>Carte, critères et sélection de biens</span></div>
            <div><strong>Conversation de projet</strong><span>Échanges avec l’assistant HomeSync</span></div>
            <div><strong>Décisions conservées</strong><span>Favoris et demandes à préparer</span></div>
          </div>
        </div>

        <p className="invite-privacy-note">Les brouillons et les informations de votre projet restent privés. Aucun message n’est envoyé à une agence sans votre validation.</p>

        <footer className="invite-modal-actions">
          <button id="btn-cancel-invite-modal" type="button" className="invite-cancel-btn" onClick={onClose}>Annuler</button>
          <button type="button" className="invite-confirm-btn" onClick={handleConfirmInvite} disabled={!name.trim()}>
            Inviter {name.trim() || 'une personne'}
          </button>
        </footer>
      </section>
    </div>
  );
}
