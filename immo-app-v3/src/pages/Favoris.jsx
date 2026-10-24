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
    navigator.clipboard.writeText(`${window.location.origin}/annonce/${annonce.id}`).then(() => {
      setCopiedId(annonce.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const s = search.toLowerCase();
  const favorisFiltered = s
    ? favoris.filter(a =>
        a.type.toLowerCase().includes(s) ||
        a.quartier.toLowerCase().includes(s) ||
        String(a.prix).includes(s) ||
        (a.achatLocation && a.achatLocation.toLowerCase().includes(s))
      )
    : favoris;

  return (
    <div className="favoris-wrapper">
      <Navbar />
      <div className="favoris-content">

        <div className="favoris-header-row">
          <h2 className="favoris-title">❤️ Mes Favoris</h2>
          <span className="favoris-count">{favoris.length} annonce{favoris.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="favoris-search-wrap">
          <span className="favoris-search-icon">🔍</span>
          <input
            type="text"
            className="favoris-search"
            placeholder="Rechercher par type, quartier, prix..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="favoris-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {favoris.length === 0 ? (
          <div className="favoris-empty">
            <div className="empty-icon">❤️</div>
            <p className="empty-title">Aucun favori pour l'instant</p>
            <p className="empty-sub">Cliquez sur ♥ dans les annonces pour les sauvegarder ici</p>
          </div>
        ) : favorisFiltered.length === 0 ? (
          <div className="favoris-empty">
            <div className="empty-icon">🔍</div>
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
                  onClick={() => navigate(`/annonce/${annonce.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="favori-img-wrap">
                    <img src={annonce.img} alt="annonce" className="favori-img" />
                    <button
                      className="favori-heart active"
                      onClick={e => { e.stopPropagation(); toggleFavori(annonce); }}
                      title="Retirer des favoris"
                    >
                      ♥
                    </button>
                    <div className={`favori-score-badge score-${color}`}>{score}</div>
                  </div>

                  <div className="favori-body">
                    <div className="favori-info">
                      <p className="favori-prix">{annonce.prix.toLocaleString('fr-FR')} €</p>
                      <p className="favori-detail-row">
                        <span className="favori-chip">{annonce.prixM2.toLocaleString('fr-FR')} €/m²</span>
                        <span className="favori-chip">{annonce.surface} m²</span>
                      </p>
                      <p className="favori-type">{annonce.type}</p>
                      <p className="favori-meta">📍 {annonce.quartier}</p>
                      <p className="favori-meta">🛏 {annonce.pieces} pièces · {annonce.etage}</p>
                    </div>
                  </div>

                  <button
                    className={`copy-btn ${copiedId === annonce.id ? 'copied' : ''}`}
                    onClick={e => handleCopyLien(e, annonce)}
                  >
                    {copiedId === annonce.id ? '✓ Lien copié !' : '🔗 Copier le lien'}
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
