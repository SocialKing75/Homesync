import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useApp, computeScore } from '../context/AppContext';
import './Favoris.css';

function getScoreColor(score) {
  if (score >= 85) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

export default function Favoris() {
  const { favoris, toggleFavori, profil } = useApp();
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState(null);
  const [search, setSearch] = useState('');

  const handleCopyLien = (e, annonce) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/bien/${encodeURIComponent(annonce.id)}`).then(() => {
      setCopiedId(annonce.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const s = search.toLowerCase();
  const favorisFiltered = s
    ? favoris.filter(a =>
        (a.type || '').toLowerCase().includes(s) ||
        (a.quartier || a.ville || '').toLowerCase().includes(s) ||
        String(a.prix).includes(s) ||
        (a.achatLocation && a.achatLocation.toLowerCase().includes(s))
      )
    : favoris;

  return (
    <div className="favoris-wrapper">
      <Navbar />
      <div className="favoris-content">

        <div className="favoris-header-row">
          <div><span className="page-kicker">Sélection de projet</span><h1 className="favoris-title">Biens conservés</h1><p>Comparez les opportunités retenues et préparez vos prises de contact.</p></div>
          <span className="favoris-count">{favoris.length} bien{favoris.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="favoris-search-wrap">
          <span className="favoris-search-icon">Rechercher</span>
          <input
            type="text"
            className="favoris-search"
            placeholder="Ville, type de bien ou budget…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="favoris-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {favoris.length === 0 ? (
          <div className="favoris-empty">
            <div className="empty-icon">0</div>
            <p className="empty-title">Aucun favori pour l'instant</p>
            <p className="empty-sub">Conservez un bien depuis vos correspondances pour le retrouver ici.</p>
          </div>
        ) : favorisFiltered.length === 0 ? (
          <div className="favoris-empty">
            <div className="empty-icon">—</div>
            <p className="empty-title">Aucun résultat pour « {search} »</p>
            <p className="empty-sub">Essayez un autre terme de recherche</p>
          </div>
        ) : (
          <div className="favoris-grid">
            {favorisFiltered.map(annonce => {
              const score = computeScore(annonce, profil);
              const color = getScoreColor(score);
              return (
                <div
                  key={annonce.id}
                  className={`favori-card border-${color}`}
                  onClick={() => navigate(`/bien/${encodeURIComponent(annonce.id)}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="favori-img-wrap">
                    <img src={annonce.img || annonce.photos?.[0]} alt={annonce.titre || annonce.type || 'Bien immobilier'} className="favori-img" />
                    <button
                      className="favori-heart active"
                      onClick={e => { e.stopPropagation(); toggleFavori(annonce); }}
                      title="Retirer des favoris"
                    >
                      ♥
                    </button>
                    <div className={`favori-score-badge score-${color}`}>{score}% compatibilité</div>
                  </div>

                  <div className="favori-body">
                    <div className="favori-info">
                      <p className="favori-prix">{annonce.prix?.toLocaleString('fr-FR')} €</p>
                      <p className="favori-detail-row">
                        {annonce.prixM2 && <span className="favori-chip">{annonce.prixM2.toLocaleString('fr-FR')} €/m²</span>}
                        <span className="favori-chip">{annonce.surface} m²</span>
                      </p>
                      <p className="favori-type">{annonce.type}</p>
                      <p className="favori-meta">{annonce.ville || annonce.quartier}{annonce.quartier && annonce.ville ? ` · ${annonce.quartier}` : ''}</p>
                      <p className="favori-meta">{annonce.pieces || annonce.nb_pieces} pièces{annonce.etage ? ` · ${annonce.etage}` : ''}</p>
                    </div>
                  </div>

                  <button
                    className={`copy-btn ${copiedId === annonce.id ? 'copied' : ''}`}
                    onClick={e => handleCopyLien(e, annonce)}
                  >
                    {copiedId === annonce.id ? 'Lien copié' : 'Copier le lien'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
