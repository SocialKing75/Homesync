import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useApp, computeScoreDetailed } from '../context/AppContext';
import './AnnoncePage.css';

function getScoreColor(score) {
  if (score >= 85) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

const QUARTIER_INFO = {
  'Mourillon':         { prixMoyenM2: 4800, evol2ans: 12.4, evolAnnee: 6.1,  rendement: 3.2 },
  'Centre-Ville':      { prixMoyenM2: 4120, evol2ans: 8.6,  evolAnnee: 4.2,  rendement: 4.1 },
  'Saint-Jean du Var': { prixMoyenM2: 3680, evol2ans: 9.2,  evolAnnee: 4.8,  rendement: 4.5 },
  'La Rode':           { prixMoyenM2: 3420, evol2ans: 5.8,  evolAnnee: 2.9,  rendement: 4.8 },
  'Pont du Las':       { prixMoyenM2: 3180, evol2ans: -1.2, evolAnnee: -0.5, rendement: 5.2 },
  'Le Pradet':         { prixMoyenM2: 3050, evol2ans: 11.3, evolAnnee: 5.7,  rendement: 4.0 },
  'La Seyne':          { prixMoyenM2: 2890, evol2ans: -0.8, evolAnnee: -0.3, rendement: 5.8 },
  'Siblas':            { prixMoyenM2: 2640, evol2ans: -3.3, evolAnnee: -1.6, rendement: 6.1 },
};

export default function AnnoncePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { annonces, profil, toggleFavori, isFavori } = useApp();

  const annonce = annonces.find(a => a.id === Number(id));
  if (!annonce) {
    return (
      <div className="ap-wrapper">
        <Navbar />
        <div className="ap-content">
          <p style={{ padding: 40, color: '#64748b' }}>Annonce introuvable.</p>
        </div>
      </div>
    );
  }

  const favori  = isFavori(annonce.id);
  const { criteria, total: score } = computeScoreDetailed(annonce, profil);
  const color   = getScoreColor(score);
  const qInfo   = QUARTIER_INFO[annonce.quartier] || { prixMoyenM2: 0, evol2ans: 0, evolAnnee: 0, rendement: 0 };

  /* AI undervaluation calculation */
  const expectedPrice = qInfo.prixMoyenM2 * annonce.surface;
  const underval = expectedPrice > 0 ? Math.round(((expectedPrice - annonce.prix) / expectedPrice) * 100) : 0;
  const isUndervalued = underval > 5;
  const isOvervalued = underval < -5;

  /* Potential sale value */
  const potentielVente = Math.round(expectedPrice * 1.05);

  return (
    <div className="ap-wrapper">
      <Navbar />
      <div className="ap-content">

        <button className="ap-back" onClick={() => navigate(-1)}>
          Retour
        </button>

        {/* ── Split Layout ── */}
        <div className="ap-split">

          {/* ═══ LEFT: Image + Stat Cards ═══ */}
          <div className="ap-left">

            {/* Hero Image */}
            <div className="ap-hero">
              <img src={annonce.img} alt={annonce.type} />
              <div className="ap-hero-overlay">
                <span className={`ap-al-pill ap-al-${annonce.achatLocation === 'Location' ? 'loc' : 'ach'}`}>
                  {annonce.achatLocation}
                </span>
              </div>
            </div>

            {/* Stat Cards Grid */}
            <div className="ap-stat-grid">
              <div className="ap-scard">
                <div className="ap-scard-label">Prix / m²</div>
                <div className="ap-scard-value">{annonce.prixM2.toLocaleString('fr-FR')} €</div>
                <div className="ap-scard-sub">Quartier moy. : {qInfo.prixMoyenM2.toLocaleString('fr-FR')} €</div>
              </div>
              <div className="ap-scard">
                <div className="ap-scard-label">Évolution sur 2 ans</div>
                <div className={`ap-scard-value ${qInfo.evol2ans >= 0 ? 'val-green' : 'val-red'}`}>
                  {qInfo.evol2ans >= 0 ? '+' : ''}{qInfo.evol2ans}%
                </div>
                <div className="ap-scard-sub">Quartier {annonce.quartier}</div>
              </div>
              <div className="ap-scard">
                <div className="ap-scard-label">Évolution annuelle</div>
                <div className={`ap-scard-value ${qInfo.evolAnnee >= 0 ? 'val-green' : 'val-red'}`}>
                  {qInfo.evolAnnee >= 0 ? '+' : ''}{qInfo.evolAnnee}%
                </div>
                <div className="ap-scard-sub">Sur les 12 derniers mois</div>
              </div>
              <div className="ap-scard">
                <div className="ap-scard-label">Rendement locatif</div>
                <div className="ap-scard-value">{qInfo.rendement}%</div>
                <div className="ap-scard-sub">Estimation brute</div>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="ap-score-section">
              <div className="ap-score-header">
                <span className="ap-score-title">Correspondance profil</span>
                <span className={`ap-score-total score-txt-${color}`}>{score} / 100</span>
              </div>
              <div className="ap-score-bar-track">
                <div className={`ap-score-bar-fill fill-${color}`} style={{ width: `${score}%` }} />
              </div>
              <div className="ap-criteria-list">
                {criteria.map((c, i) => (
                  <div key={i} className="ap-criterion">
                    <div className="ap-criterion-left">
                      <span className={`ap-criterion-dot ${c.met ? 'dot-green' : c.partial ? 'dot-yellow' : 'dot-red'}`} />
                      <span className="ap-criterion-label">{c.label}</span>
                      <span className="ap-criterion-detail">{c.detail}</span>
                    </div>
                    <div className="ap-criterion-right">
                      <div className="ap-crit-mini-track">
                        <div
                          className={`ap-crit-mini-fill ${c.met ? 'fill-green' : c.partial ? 'fill-yellow' : 'fill-red'}`}
                          style={{ width: `${(c.pts / c.max) * 100}%` }}
                        />
                      </div>
                      <span className="ap-crit-pts">{c.pts}/{c.max}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT: Score, Price, AI Insights, Description ═══ */}
          <div className="ap-right">

            {/* Score Badge */}
            <div className={`ap-score-badge score-bg-${color}`}>
              <div className="ap-score-badge-val">{score}</div>
              <div className="ap-score-badge-label">/ 100</div>
            </div>

            {/* Price */}
            <div className="ap-price-block">
              <div className="ap-price">{annonce.prix.toLocaleString('fr-FR')} €</div>
              <div className="ap-prixm2">{annonce.prixM2.toLocaleString('fr-FR')} €/m²</div>
            </div>

            {/* Actions */}
            <div className="ap-actions">
              {annonce.lien && (
                <a href={annonce.lien} target="_blank" rel="noopener noreferrer" className="ap-link-btn">
                  Voir l'annonce
                </a>
              )}
            </div>

            {/* Potentiel de vente */}
            <div className="ap-potential">
              <div className="ap-potential-label">Potentiel de vente</div>
              <div className="ap-potential-value">{potentielVente.toLocaleString('fr-FR')} €</div>
              <div className="ap-potential-sub">Valeur estimée à la revente (+5% marge)</div>
            </div>

            {/* AI Valuation Insight */}
            <div className={`ap-ai-box ${isUndervalued ? 'ai-box-green' : isOvervalued ? 'ai-box-red' : 'ai-box-neutral'}`}>
              <div className="ap-ai-title">Analyse IA</div>
              <div className="ap-ai-text">
                {isUndervalued ? (
                  <>
                    Ce bien est <strong>sous-évalué de {underval}%</strong> par rapport aux biens similaires du quartier.
                    <br/><br/>
                    <span className="ap-ai-verdict">Bonne opportunité d'achat.</span>
                  </>
                ) : isOvervalued ? (
                  <>
                    Ce bien est <strong>surévalué de {Math.abs(underval)}%</strong> par rapport aux biens similaires du quartier.
                    <br/><br/>
                    <span className="ap-ai-verdict ap-ai-caution">Prix au-dessus du marché.</span>
                  </>
                ) : (
                  <>
                    Ce bien est au <strong>prix du marché</strong> par rapport aux biens similaires du quartier.
                    <br/><br/>
                    <span className="ap-ai-verdict ap-ai-neutral">Prix cohérent.</span>
                  </>
                )}
              </div>
            </div>

            {/* Property Details */}
            <div className="ap-details-card">
              <div className="ap-details-title">Description du bien</div>
              <div className="ap-details-type">{annonce.type}</div>
              <div className="ap-details-grid">
                <div className="ap-dg-item">
                  <span className="ap-dg-label">Surface</span>
                  <span className="ap-dg-val">{annonce.surface} m²</span>
                </div>
                <div className="ap-dg-item">
                  <span className="ap-dg-label">Pièces</span>
                  <span className="ap-dg-val">{annonce.pieces}</span>
                </div>
                <div className="ap-dg-item">
                  <span className="ap-dg-label">Étage</span>
                  <span className="ap-dg-val">{annonce.etage}</span>
                </div>
                <div className="ap-dg-item">
                  <span className="ap-dg-label">Quartier</span>
                  <span className="ap-dg-val">{annonce.quartier}</span>
                </div>
              </div>
              {annonce.description && (
                <p className="ap-description">{annonce.description}</p>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
