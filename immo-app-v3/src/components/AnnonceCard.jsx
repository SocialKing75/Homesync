import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './AnnonceCard.css';

function getScoreColor(score) {
  if (score >= 85) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

function getScoreLabel(score) {
  if (score >= 85) return '100% des critères';
  if (score >= 60) return 'Critères partiels';
  return 'Critères faibles';
}

export default function AnnonceCard({ annonce }) {
  const { toggleFavori, isFavori } = useApp();
  const navigate = useNavigate();
  const favori = isFavori(annonce.id);
  const score  = annonce.score ?? 0;
  const color  = getScoreColor(score);

  return (
    <div className="annonce-card" onClick={() => navigate(`/annonce/${annonce.id}`)} style={{ cursor: 'pointer' }}>
      <div className="annonce-img-wrapper">
        <img src={annonce.img} alt="annonce" className="annonce-img" loading="lazy" />
        <button
          className={`annonce-heart ${favori ? 'active' : ''}`}
          onClick={e => { e.stopPropagation(); toggleFavori(annonce); }}
          title={favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          ♥
        </button>
        <div className={`annonce-score-badge score-${color}`}>
          <span className="badge-num">{score}</span>
        </div>
      </div>

      <div className="annonce-body">
        <div className="annonce-top-row">
          <p className="annonce-prix">{annonce.prix.toLocaleString('fr-FR')} €</p>
          <span className={`annonce-chip chip-al chip-al-${annonce.achatLocation === 'Location' ? 'loc' : 'ach'}`}>
            {annonce.achatLocation}
          </span>
        </div>
        <div className="annonce-row">
          <span className="annonce-chip chip-gray">{annonce.prixM2.toLocaleString('fr-FR')} €/m²</span>
          <span className="annonce-chip chip-gray">{annonce.surface} m²</span>
        </div>
        <p className="annonce-type">{annonce.type}</p>
        <div className="annonce-row">
          <span className="annonce-meta">📍 {annonce.quartier}</span>
          <span className="annonce-meta">🛏 {annonce.pieces} p.</span>
          <span className={`annonce-etage etage-${color}`}>{annonce.etage}</span>
        </div>
        <div className={`annonce-tag tag-${color}`}>{getScoreLabel(score)}</div>
      </div>
    </div>
  );
}
