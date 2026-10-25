import { useState } from 'react';
import './InviteModal.css';

export default function InviteModal({ isOpen, onClose, onInviteSuccess }) {
  const [name, setName] = useState('Alex');
  const [copied, setCopied] = useState(false);
  const inviteLink = `https://toulonfind.ai/r/toulon-t3-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const handleConfirmInvite = () => {
    if (name.trim()) {
      onInviteSuccess(name.trim());
    }
    onClose();
  };

  return (
    <div className="invite-modal-backdrop" onClick={onClose}>
      <div className="invite-modal-card" onClick={e => e.stopPropagation()}>
        <button id="btn-close-invite-modal" className="invite-modal-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>

        <div className="invite-modal-header">
          <div className="invite-badge-icon">👥</div>
          <h2 className="invite-title">Inviter dans votre recherche</h2>
          <p className="invite-sub">
            Partenaire ou futur-e co-acquéreur / colocataire : la personne invitée rejoint la conversation privée et la carte, et ajoute ses propres critères.
          </p>
        </div>

        <div className="invite-form-group">
          <label htmlFor="invite-name-input">Prénom de la personne (facultatif)</label>
          <input
            id="invite-name-input"
            type="text"
            className="invite-input"
            placeholder="Ex : Alex, Sarah..."
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="invite-form-group">
          <label>Lien d'invitation sécurisé</label>
          <div className="invite-link-row">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="invite-link-input"
            />
            <button
              type="button"
              className={`invite-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
            >
              {copied ? '✓ Copié !' : 'Copier le lien'}
            </button>
          </div>
          <span className="invite-validity-note">
            Lien sécurisé chiffré de bout en bout · Valable 7 jours.
          </span>
        </div>

        {/* 2 Comparison Cards (Inspired by Reference) */}
        <div className="invite-transparency-grid">
          <div className="transparency-card shared-card">
            <h4>✓ Partagé avec {name || 'la personne'}</h4>
            <ul>
              <li>Conversation privée avec l'IA</li>
              <li>Carte et critères communs</li>
              <li>Favoris et sélections</li>
              <li>Messages envoyés aux agences</li>
            </ul>
          </div>

          <div className="transparency-card private-card">
            <h4>🔒 Jamais partagé aux annonceurs</h4>
            <ul>
              <li>Votre conversation privée</li>
              <li>Vos critères de négociation détaillés</li>
              <li>Vos simulations de financement</li>
              <li>Les brouillons non validés</li>
            </ul>
          </div>
        </div>

        <p className="invite-consensus-note">
          ⚖️ <em>Un changement de contrainte commune (budget, quartier, surface indispensable) est toujours soumis à la confirmation des deux personnes.</em>
        </p>

        <div className="invite-modal-actions">
          <button id="btn-cancel-invite-modal" type="button" className="invite-cancel-btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="invite-confirm-btn"
            onClick={handleConfirmInvite}
          >
            Faire entrer {name || 'le co-acquéreur'} dans la recherche
          </button>
        </div>
      </div>
    </div>
  );
}
