import React from 'react';
import { getListingSourceUrl, getReportUrl, isLegacyDvfProperty } from '../services/api';
import './PropertyDetailBreakdown.css';
import './GoldenMatchingEffect.css';

const formatNumber = (value, suffix = '') => (
  Number.isFinite(Number(value)) ? `${Number(value).toLocaleString('fr-FR')}${suffix}` : 'Non renseigné'
);

export default function PropertyDetailBreakdown({
  annonce,
  onBack,
  isFavori = false,
  onToggleFavori = () => {},
  onRequestVisit = () => {},
  onOpenTinder = () => {},
}) {
  if (!annonce) return null;

  const pieces = annonce.pieces ?? annonce.nb_pieces;
  const score = Number(annonce.matchScore ?? annonce.score ?? annonce.backend_score);
  const hasScore = Number.isFinite(score);
  const roundedScore = hasScore ? Math.round(score) : null;
  const hasDvfReport = isLegacyDvfProperty(annonce);
  const sourceUrl = getListingSourceUrl(annonce);
  const location = [annonce.ville, annonce.quartier]
    .filter(Boolean)
    .filter((item, index, values) => values.indexOf(item) === index)
    .join(' · ') || 'France';
  const exterior = [annonce.terrasse && 'Terrasse', annonce.jardin && 'Jardin', annonce.piscine && 'Piscine']
    .filter(Boolean)
    .join(' · ');
  const facts = [
    { label: 'Prix', value: formatNumber(annonce.prix, ' €') },
    { label: 'Surface', value: formatNumber(annonce.surface, ' m²') },
    pieces && { label: 'Configuration', value: `${pieces} pièce${Number(pieces) > 1 ? 's' : ''}` },
    annonce.prixM2 && { label: 'Prix au m²', value: formatNumber(annonce.prixM2, ' €/m²') },
    annonce.dpe && { label: 'DPE', value: annonce.dpe },
    exterior && { label: 'Extérieur', value: exterior },
  ].filter(Boolean);
  const reasons = [
    { label: 'Localisation', value: location },
    pieces && { label: 'Configuration', value: `${annonce.type || 'Bien'} · ${pieces} pièce${Number(pieces) > 1 ? 's' : ''}` },
    annonce.surface && { label: 'Surface', value: `${formatNumber(annonce.surface, ' m²')} habitables` },
    hasScore && { label: 'Compatibilité', value: `${roundedScore}% selon les critères actuels` },
  ].filter(Boolean);

  return (
    <section className="property-detail-breakdown-pane" aria-label="Analyse du bien">
      <header className="pdb-topbar">
        <button id="btn-back-to-chat" className="pdb-back-btn" onClick={onBack}>Retour à la conversation</button>
        <button
          className={`pdb-fav-btn ${isFavori ? 'active' : ''}`}
          onClick={onToggleFavori}
          aria-pressed={isFavori}
        >
          {isFavori ? 'Enregistré' : 'Enregistrer'}
        </button>
      </header>

      <div className="pdb-content">
        <div className="pdb-eyebrow-row">
          <span className="pdb-eyebrow">Analyse du bien</span>
          <span className="pdb-source-status">{hasDvfReport ? 'Données DVF' : 'Annonce nationale'}</span>
        </div>

        <div className="pdb-heading">
          <p className="pdb-location-sub">{location}</p>
          <h2 className="pdb-title">{annonce.titre || `${annonce.type || 'Bien immobilier'} · ${pieces || ''} pièces`}</h2>
          <p className="pdb-reference">Référence {annonce.id}</p>
        </div>

        <div className="pdb-price-card">
          <div>
            <span className="pdb-price-label">Prix de l’annonce</span>
            <strong className="pdb-main-price">{formatNumber(annonce.prix, ' €')}</strong>
            {annonce.prixM2 && <span className="pdb-price-note">{formatNumber(annonce.prixM2, ' €/m²')}</span>}
          </div>
          {hasScore && (
            <div className={`pdb-score ${roundedScore >= 80 ? 'is-priority' : ''}`}>
              <strong>{roundedScore}%</strong>
              <span>compatibilité</span>
            </div>
          )}
        </div>

        <div className="pdb-facts" aria-label="Caractéristiques du bien">
          {facts.map((fact) => (
            <div className="pdb-fact" key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>

        <article className="pdb-breakdown-section">
          <div className="pdb-section-heading">
            <div>
              <span className="pdb-eyebrow">Lecture HomeSync</span>
              <h3>Repères pour votre projet</h3>
            </div>
            {hasScore && <span className="pdb-priority-label">{roundedScore >= 80 ? 'Prioritaire' : 'À comparer'}</span>}
          </div>
          <div className="pdb-reasons">
            {reasons.map((reason) => (
              <div className="pdb-reason" key={reason.label}>
                <span>{reason.label}</span>
                <strong>{reason.value}</strong>
              </div>
            ))}
          </div>
          <p className="pdb-data-note">Les informations présentées proviennent de l’annonce source. Vérifiez les éléments importants auprès de l’annonceur.</p>
        </article>

        <footer className="pdb-actions">
          <button id="btn-agency-visit-request" type="button" className="pdb-btn-agency" onClick={onRequestVisit}>
            Préparer une demande de visite
          </button>
          <div className="pdb-secondary-actions">
            {hasDvfReport ? (
              <a href={getReportUrl(annonce.id)} target="_blank" rel="noopener noreferrer" className="pdb-btn-secondary">Rapport d’expertise DVF</a>
            ) : sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="pdb-btn-secondary">Voir l’annonce source</a>
            ) : (
              <span className="pdb-btn-secondary pdb-btn-disabled">Analyse DVF indisponible</span>
            )}
            <button type="button" className="pdb-btn-secondary pdb-btn-matching" onClick={onOpenTinder}>Voir les correspondances</button>
          </div>
        </footer>
      </div>
    </section>
  );
}
