import React from 'react';
import { getReportUrl } from '../services/api';
import './PropertyDetailBreakdown.css';

export default function PropertyDetailBreakdown({
  annonce,
  onBack,
  coUsers = [],
  isFavori = false,
  onToggleFavori = () => {},
  onRequestVisit = () => {},
  onOpenTinder = () => {},
}) {
  if (!annonce) return null;

  const coUser = coUsers[0] || { name: 'Alex' };
  const quartierShort = annonce.quartier ? annonce.quartier.split('-')[0].trim() : 'Toulon';

  return (
    <div className="property-detail-breakdown-pane">
      {/* ── TOP NAV BAR ── */}
      <div className="pdb-topbar">
        <button id="btn-back-to-chat" className="pdb-back-btn" onClick={onBack}>
          ‹ Retour à la conversation
        </button>
        <div className="pdb-top-actions">
          <button
            className={`pdb-fav-btn ${isFavori ? 'active' : ''}`}
            onClick={onToggleFavori}
            title={isFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            {isFavori ? '❤️ Favori' : '🤍 Enregistrer'}
          </button>
        </div>
      </div>

      {/* ── PHOTO CONTAINER ── */}
      <div className="pdb-photo-wrap">
        <img
          src={annonce.img}
          alt={annonce.titre || annonce.type}
          className="pdb-photo-img"
        />
        <div className="pdb-golden-score-badge">
          <span className="badge-crown">👑</span>
          <span>{Math.round(annonce.score || 85)}% MATCH OR</span>
        </div>
        <div className="pdb-photo-tag">Photo vérifiée DVF</div>
      </div>

      {/* ── HEADLINE & PRICE ── */}
      <div className="pdb-content">
        <div className="pdb-location-sub">
          📍 {quartierShort} · Toulon · Réf #{annonce.id}
        </div>
        <h2 className="pdb-title">
          {annonce.titre || `${annonce.type} ${annonce.pieces} pièces avec vue`}
        </h2>
        <div className="pdb-price-row">
          <span className="pdb-main-price">{annonce.prix?.toLocaleString('fr-FR')} €</span>
          <span className="pdb-charges-tag">FAI · {annonce.prixM2?.toLocaleString('fr-FR')} €/m²</span>
        </div>

        {/* ── 8-CELL SPEC GRID (Screenshot 3 Reference) ── */}
        <div className="pdb-specs-grid">
          <div className="spec-cell">
            <span className="spec-label">Prix</span>
            <span className="spec-val">{annonce.prix?.toLocaleString('fr-FR')} €</span>
          </div>
          <div className="spec-cell">
            <span className="spec-label">Surface</span>
            <span className="spec-val">{annonce.surface} m²</span>
          </div>
          <div className="spec-cell">
            <span className="spec-label">Pièces</span>
            <span className="spec-val">{annonce.pieces} ({Math.max(1, annonce.pieces - 1)} ch.)</span>
          </div>
          <div className="spec-cell">
            <span className="spec-label">Étage</span>
            <span className="spec-val">{annonce.etage || '3e étage'}</span>
          </div>
          <div className="spec-cell">
            <span className="spec-label">Ascenseur</span>
            <span className="spec-val">Oui</span>
          </div>
          <div className="spec-cell">
            <span className="spec-label">Extérieur</span>
            <span className="spec-val">{annonce.surfaceExterieur ? `${annonce.surfaceExterieur} m² balcon` : 'Balcon terrasse 8 m²'}</span>
          </div>
          <div className="spec-cell">
            <span className="spec-label">Disponible</span>
            <span className="spec-val">Immédiat</span>
          </div>
          <div className="spec-cell spec-cell-commute">
            <span className="spec-label">Trajet {coUser.name}</span>
            <span className="spec-val highlight-commute">12 min à pied</span>
          </div>
        </div>

        {/* ── COMPREHENSIVE MATCH BREAKDOWN (POURQUOI CE LOGEMENT VOUS CORRESPOND) ── */}
        <div className="pdb-breakdown-section">
          <h3 className="breakdown-heading">Pourquoi ce logement vous correspond</h3>

          {/* Exigences communes */}
          <div className="breakdown-group">
            <div className="breakdown-group-title">EXIGENCES</div>
            <div className="check-item checked">
              <span className="check-icon">✔</span>
              <span className="check-text">
                <strong>T{annonce.pieces}</strong> — {annonce.pieces} pièces ({Math.max(1, annonce.pieces - 1)} chambres)
              </span>
            </div>
            <div className="check-item checked">
              <span className="check-icon">✔</span>
              <span className="check-text">
                <strong>Budget respecté</strong> — {annonce.prix?.toLocaleString('fr-FR')} € FAI
              </span>
            </div>
            <div className="check-item checked">
              <span className="check-icon">✔</span>
              <span className="check-text">
                <strong>Trajet ≤ 20 min vers Port / Arsenal ({coUser.name})</strong> — 12 min à pied
              </span>
            </div>
            <div className="check-item checked">
              <span className="check-icon">✔</span>
              <span className="check-text">
                <strong>Ascenseur</strong> — oui, accès direct
              </span>
            </div>
          </div>

          {/* Préférences */}
          <div className="breakdown-group">
            <div className="breakdown-group-title">PRÉFÉRENCES</div>
            <div className="check-item checked">
              <span className="check-icon">✔</span>
              <span className="check-text">
                <strong>Trajet ≤ 15 min ({coUser.name})</strong> — 12 min à pied
              </span>
            </div>
            <div className="check-item checked">
              <span className="check-icon">✔</span>
              <span className="check-text">
                <strong>Extérieur ensoleillé</strong> — terrasse plein sud avec vue dégagée
              </span>
            </div>
            <div className="check-item checked">
              <span className="check-icon">✔</span>
              <span className="check-text">
                <strong>Secteur Gold Accord</strong> — {quartierShort} (quartier de consensus n°1)
              </span>
            </div>
          </div>
        </div>

        {/* ── ACTION BUTTONS ── */}
        <div className="pdb-actions">
          <button
            id="btn-agency-visit-request"
            type="button"
            className="pdb-btn-agency"
            onClick={onRequestVisit}
          >
            💬 Demander une visite à l'agence
          </button>

          <a
            href={getReportUrl(annonce.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="pdb-btn-pdf"
          >
            📄 Rapport d'expertise DVF (PDF)
          </a>

          <button
            type="button"
            className="pdb-btn-tinder"
            onClick={onOpenTinder}
          >
            👑 Swiper dans le Tinder Matcher
          </button>
        </div>
      </div>
    </div>
  );
}
