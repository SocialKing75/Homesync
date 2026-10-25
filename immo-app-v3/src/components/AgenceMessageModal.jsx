import { useState } from 'react';
import './AgenceMessageModal.css';

export default function AgenceMessageModal({ isOpen, onClose, annonce, coUsers = [] }) {
  const [sent, setSent] = useState(false);
  const coNames = coUsers.length > 0 ? `Marc Ivan et ${coUsers.map(u => u.name).join(', ')}` : 'Marc Ivan';
  const agenceNom = `Agence Toulon ${annonce?.quartier?.split(' ')[0] || 'Littoral'}`;

  const defaultDraft = `Bonjour,\n\nNous sommes très intéressés par votre ${annonce?.type || 'bien'} de ${annonce?.surface || 68} m² situé à ${annonce?.quartier || 'Toulon'} proposé à ${annonce?.prix?.toLocaleString('fr-FR') || '280 000'} € FAI (Réf #${annonce?.id || 101}). Nous serions ${coUsers.length > 0 ? 'deux acquéreurs' : 'acquéreur'}, ${coNames}.\n\nSerait-il possible de convenir d'un créneau de visite ? Nous serions disponibles [à compléter : vos créneaux prioritaires en semaine ou samedi].\n\nBien cordialement,\n${coNames}`;

  const [message, setMessage] = useState(defaultDraft);

  if (!isOpen || !annonce) return null;

  const handleSend = () => {
    setSent(true);
    setTimeout(() => {
      setSent(false);
      onClose();
    }, 2400);
  };

  return (
    <div className="agence-modal-backdrop" onClick={onClose}>
      <div className="agence-modal-card" onClick={e => e.stopPropagation()}>
        {/* Top Back Navigation */}
        <div className="agence-modal-topbar">
          <button className="agence-back-btn" onClick={onClose}>
            ← Retour à la recherche
          </button>
          <span className="agence-modal-close-x" onClick={onClose}>✕</span>
        </div>

        {/* Agency Header Banner */}
        <div className="agence-header-banner">
          <div className="agence-avatar-icon">🏢</div>
          <div>
            <h3 className="agence-title">Avec l'annonceur · {agenceNom}</h3>
            <p className="agence-sub">Partenaire certifié HomeSync · Réponse moyenne en 2h</p>
          </div>
          <div className="agence-participants-pills">
            <span>👥 Participants : {coNames}, {agenceNom}</span>
          </div>
        </div>

        {/* Privacy Separation Notice (Inspired by Reference) */}
        <div className="agence-privacy-notice">
          <span className="notice-lock-icon">🔒</span>
          <p>
            <strong>Ce fil est strictement réservé à la prise de contact avec {agenceNom}.</strong><br />
            L'annonceur voit uniquement les messages validés ici. Votre conversation privée avec l'IA et vos critères détaillés restent confidentiels.
          </p>
        </div>

        {/* Embedded Property Card */}
        <div className="agence-prop-chip">
          <img src={annonce.img} alt="" className="agence-prop-thumb" />
          <div className="agence-prop-info">
            <span className="prop-chip-title">{annonce.titre || `${annonce.type} ${annonce.pieces} pièces`}</span>
            <span className="prop-chip-meta">{annonce.prix?.toLocaleString('fr-FR')} € · {annonce.surface} m² · 📍 {annonce.quartier}</span>
          </div>
          <span className="prop-chip-score">👑 {Math.round(annonce.score || 85)}% Match Or</span>
        </div>

        {/* Message Draft Form */}
        {sent ? (
          <div className="agence-sent-confirmation">
            <div className="sent-check-icon">✓</div>
            <h4>Demande de visite transmise avec succès !</h4>
            <p>
              Votre message a été envoyé à <strong>{agenceNom}</strong>. Vous recevrez une notification par email dès la confirmation du créneau.
            </p>
          </div>
        ) : (
          <div className="agence-draft-container">
            <div className="draft-header">
              <div className="draft-badge">Brouillon IA · Non envoyé</div>
              <span className="draft-author-note">
                Préparé par l'assistant · Validable par {coNames}
              </span>
            </div>

            <textarea
              className="draft-textarea"
              rows={8}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Rédigez votre demande de visite..."
            />

            <div className="draft-footer-hint">
              💡 <em>L'assistant a laissé « [à compléter : vos créneaux...] » pour vous permettre d'indiquer vos jours et heures de disponibilité préférés.</em>
            </div>

            <div className="agence-draft-actions">
              <button id="btn-cancel-agence-message" type="button" className="draft-btn-cancel" onClick={onClose}>
                Annuler
              </button>
              <button
                id="btn-send-agence-message"
                type="button"
                className="draft-btn-send"
                onClick={handleSend}
              >
                ✓ Valider et envoyer la demande de visite
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
