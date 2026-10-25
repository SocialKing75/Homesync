import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, computeScoreDetailed } from '../context/AppContext';
import { getListingSourceUrl, getReportUrl, isLegacyDvfProperty } from '../services/api';
import './TinderMatch.css';

export default function TinderMatch() {
  const { annonces, profil, toggleFavori, isFavori, marketDashboard, marketStats } = useApp();
  const navigate = useNavigate();

  // Scored deck of properties sorted by match score descending
  const deck = useMemo(() => {
    return annonces
      .map(prop => {
        const { criteria, total } = computeScoreDetailed(prop, profil);
        const score = typeof prop.backend_score === 'number' ? Math.round(prop.backend_score) : total;
        return {
          ...prop,
          matchScore: score,
          criteria,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [annonces, profil]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]); // { prop, action: 'like' | 'pass' }
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [flyDirection, setFlyDirection] = useState(null); // 'left' | 'right' | 'up'
  const [matchCelebration, setMatchCelebration] = useState(null); // Property for "It's a Match!"
  const [scoreModalProp, setScoreModalProp] = useState(null); // Property for score breakdown

  const cardRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });

  const currentProp = deck[currentIndex] || null;
  const nextProp = deck[currentIndex + 1] || null;
  const thirdProp = deck[currentIndex + 2] || null;

  // District market price for comparison
  const districtAvg = useMemo(() => {
    if (!currentProp) return null;
    if (marketDashboard?.QUARTIERS) {
      const match = marketDashboard.QUARTIERS.find(
        q => q.nom.toLowerCase() === currentProp.quartier?.toLowerCase()
      );
      if (match?.moy) return match.moy;
    }
    return marketStats?.avg_price_m2 || 3400;
  }, [currentProp, marketDashboard, marketStats]);

  const undervalPct = useMemo(() => {
    if (!currentProp || !districtAvg || !currentProp.prixM2) return 0;
    return Math.round(((districtAvg - currentProp.prixM2) / districtAvg) * 100);
  }, [currentProp, districtAvg]);

  // Handle Swipe Actions
  const handleSwipe = useCallback((direction) => {
    if (!currentProp) return;

    setFlyDirection(direction);

    setTimeout(() => {
      const swiped = currentProp;
      if (direction === 'right' || direction === 'up') {
        if (!isFavori(swiped.id)) {
          toggleFavori(swiped);
        }
        if (swiped.matchScore >= 75) {
          setMatchCelebration(swiped);
        }
        setHistory(prev => [...prev, { prop: swiped, action: 'like' }]);
      } else {
        setHistory(prev => [...prev, { prop: swiped, action: 'pass' }]);
      }

      setCurrentIndex(prev => prev + 1);
      setFlyDirection(null);
      setDragOffset({ x: 0, y: 0 });
    }, 280);
  }, [currentProp, isFavori, toggleFavori]);

  const handleUndo = () => {
    if (history.length === 0 || currentIndex === 0) return;
    const last = history[history.length - 1];
    if (last.action === 'like' && isFavori(last.prop.id)) {
      toggleFavori(last.prop);
    }
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleResetDeck = () => {
    setCurrentIndex(0);
    setHistory([]);
    setDragOffset({ x: 0, y: 0 });
  };

  // Keyboard navigation (ArrowLeft = Pass, ArrowRight = Like, Space = Details)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (matchCelebration || scoreModalProp) return;
      if (e.key === 'ArrowRight') handleSwipe('right');
      if (e.key === 'ArrowLeft') handleSwipe('left');
      if (e.key === 'ArrowUp') handleSwipe('up');
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) handleUndo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSwipe, matchCelebration, scoreModalProp]);

  // Touch and Mouse Drag Gestures
  const handleTouchStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startPos.current = { x: clientX, y: clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - startPos.current.x;
    const deltaY = clientY - startPos.current.y;
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset.x > 110) {
      handleSwipe('right');
    } else if (dragOffset.x < -110) {
      handleSwipe('left');
    } else if (dragOffset.y < -130) {
      handleSwipe('up');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // Drag rotation and opacity calculations
  const rotateDeg = dragOffset.x * 0.08;
  const likeOpacity = Math.min(1, Math.max(0, dragOffset.x / 80));
  const passOpacity = Math.min(1, Math.max(0, -dragOffset.x / 80));

  let cardTransform = '';
  if (flyDirection === 'right') {
    cardTransform = 'translate3d(1200px, 40px, 0) rotate(35deg)';
  } else if (flyDirection === 'left') {
    cardTransform = 'translate3d(-1200px, 40px, 0) rotate(-35deg)';
  } else if (flyDirection === 'up') {
    cardTransform = 'translate3d(0, -1200px, 0) scale(1.1)';
  } else if (isDragging || dragOffset.x !== 0 || dragOffset.y !== 0) {
    cardTransform = `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotateDeg}deg)`;
  }

  // Get Score Color
  const getScoreColor = (sc) => {
    if (sc >= 85) return '#10b981';
    if (sc >= 65) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="tinder-container">
      {/* ── TOP HEADER / STATS BAR ── */}
      <div className="tinder-topbar">
        <div className="tinder-badge-title">
          <span className="tinder-fire-icon">🔥</span>
          <span className="tinder-title-text">HomeSync Matcher</span>
        </div>
        <div className="tinder-progress-pill">
          <span>{deck.length - currentIndex} biens restants</span>
          <span className="tinder-history-count">❤️ {history.filter(h => h.action === 'like').length} coups de cœur</span>
        </div>
      </div>

      {/* ── CARD STACK CONTAINER ── */}
      <div className="tinder-deck-area">
        {currentProp ? (
          <>
            {/* Third Card in Background */}
            {thirdProp && (
              <div className="tinder-card tinder-card-back-2">
                <div className="tinder-card-photo-wrap">
                  <img src={thirdProp.img} alt="" className="tinder-card-photo" />
                </div>
              </div>
            )}

            {/* Second Card in Background */}
            {nextProp && (
              <div className="tinder-card tinder-card-back-1">
                <div className="tinder-card-photo-wrap">
                  <img src={nextProp.img} alt="" className="tinder-card-photo" />
                  <div className="tinder-card-gradient" />
                </div>
                <div className="tinder-card-preview-info">
                  <span className="tinder-match-pill-mini">
                    🔥 {nextProp.matchScore}% Match
                  </span>
                  <span className="tinder-price-preview">{nextProp.prix?.toLocaleString('fr-FR')} €</span>
                </div>
              </div>
            )}

            {/* Top Interactive Card */}
            <div
              ref={cardRef}
              className={`tinder-card tinder-card-top ${flyDirection ? 'flying' : ''}`}
              style={{
                transform: cardTransform,
                transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              onMouseDown={handleTouchStart}
              onMouseMove={handleTouchMove}
              onMouseUp={handleTouchEnd}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Dynamic Swipe Badges (Like / Pass) */}
              <div
                className="tinder-stamp stamp-like"
                style={{ opacity: flyDirection === 'right' || flyDirection === 'up' ? 1 : likeOpacity }}
              >
                COUP DE CŒUR ❤️
              </div>
              <div
                className="tinder-stamp stamp-pass"
                style={{ opacity: flyDirection === 'left' ? 1 : passOpacity }}
              >
                PASSER ✕
              </div>

              {/* Photo & Image Gradient Overlay */}
              <div className="tinder-card-photo-wrap">
                <img
                  src={currentProp.img}
                  alt={currentProp.titre || currentProp.type}
                  className="tinder-card-photo"
                  draggable={false}
                />
                <div className="tinder-card-gradient" />

                {/* Floating Match Score Badge on Image (Golden Match) */}
                <div
                  className={`tinder-match-badge ${currentProp.matchScore >= 75 ? 'badge-golden' : ''}`}
                  style={{
                    borderColor: currentProp.matchScore >= 75 ? '#fbbf24' : getScoreColor(currentProp.matchScore),
                    boxShadow: currentProp.matchScore >= 75
                      ? '0 0 25px rgba(245, 158, 11, 0.65)'
                      : `0 0 20px ${getScoreColor(currentProp.matchScore)}40`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setScoreModalProp(currentProp);
                  }}
                  title="Voir le détail du score de matching"
                >
                  <span className="tinder-match-fire">{currentProp.matchScore >= 75 ? '👑' : '🔥'}</span>
                  <div className="tinder-match-number-wrap">
                    <span className="tinder-match-number">{currentProp.matchScore}%</span>
                    <span className="tinder-match-label">{currentProp.matchScore >= 75 ? 'MATCH OR ℹ️' : 'MATCH IA ℹ️'}</span>
                  </div>
                </div>

                {/* Undervaluation Pill */}
                {undervalPct > 3 && (
                  <div className="tinder-underval-pill">
                    ✦ {undervalPct}% sous le marché {currentProp.quartier}
                  </div>
                )}

                {/* Quick Info Bar Overlay */}
                <div className="tinder-photo-overlay-content">
                  <div className="tinder-price-row">
                    <span className="tinder-price">{currentProp.prix?.toLocaleString('fr-FR')} €</span>
                    <span className="tinder-price-m2">{currentProp.prixM2?.toLocaleString('fr-FR')} €/m²</span>
                  </div>
                  <h3 className="tinder-prop-title">
                    {currentProp.titre || `${currentProp.type} ${currentProp.pieces} pièces`}
                  </h3>
                  <div className="tinder-chips-row">
                    <span className="tinder-chip">📍 {currentProp.quartier}</span>
                    <span className="tinder-chip">📐 {currentProp.surface} m²</span>
                    <span className="tinder-chip">🛏 {currentProp.pieces} pièces</span>
                    <span className="tinder-chip">🏢 {currentProp.etage}</span>
                    {currentProp.has_parking && <span className="tinder-chip chip-highlight">🚗 Parking</span>}
                    {currentProp.has_garden && <span className="tinder-chip chip-highlight">🌿 Jardin</span>}
                  </div>
                </div>
              </div>

              {/* Card Footer / Quick Pitch */}
              <div className="tinder-card-body">
                <p className="tinder-description">
                  {currentProp.description?.replace(/<[^>]*>?/gm, '').slice(0, 160) ||
                    `Superbe opportunité au cœur de ${currentProp.quartier}, idéal pour votre recherche avec un taux de compatibilité élevé.`}...
                </p>

                <div className="tinder-card-micro-features">
                  <div className="micro-feat">
                    <span className="mf-label">Distance Centre</span>
                    <span className="mf-val">{currentProp.distance_to_center_km || 1.2} km</span>
                  </div>
                  <div className="micro-feat">
                    <span className="mf-label">Quartier Toulon</span>
                    <span className="mf-val">{currentProp.quartier}</span>
                  </div>
                  <div className="micro-feat">
                    <span className="mf-label">Projet</span>
                    <span className="mf-val">{currentProp.achatLocation || 'Achat'}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty Deck State */
          <div className="tinder-empty-state">
            <div className="tinder-empty-icon">🎉</div>
            <h2 className="tinder-empty-title">Vous avez exploré tout le marché !</h2>
            <p className="tinder-empty-sub">
              Vous avez passé en revue les <strong>{deck.length} biens toulonnais</strong> indexés par notre moteur IA.
            </p>
            <div className="tinder-empty-actions">
              <button className="tinder-btn-primary" onClick={() => navigate('/favoris')}>
                ❤️ Voir mes {history.filter(h => h.action === 'like').length} coups de cœur
              </button>
              <button className="tinder-btn-secondary" onClick={handleResetDeck}>
                🔄 Recommencer la sélection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── ACTION CONTROLS BUTTONS (Tinder Style) ── */}
      {currentProp && (
        <div className="tinder-actions-bar">
          {/* Undo */}
          <button
            className="tinder-act-btn btn-undo"
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Annuler le dernier swipe (Cmd+Z)"
          >
            <span>↺</span>
          </button>

          {/* Pass (Dislike) */}
          <button
            className="tinder-act-btn btn-pass"
            onClick={() => handleSwipe('left')}
            title="Passer cette annonce (Touche ←)"
          >
            <span>✕</span>
          </button>

          {/* Super Like / Star */}
          <button
            className="tinder-act-btn btn-superlike"
            onClick={() => handleSwipe('up')}
            title="Super Like / Coup de cœur prioritaire (Touche ↑)"
          >
            <span>★</span>
          </button>

          {/* Like */}
          <button
            className="tinder-act-btn btn-like"
            onClick={() => handleSwipe('right')}
            title="Ajouter aux coups de cœur (Touche →)"
          >
            <span>♥</span>
          </button>

          {/* Details / Inspection */}
          <button
            className="tinder-act-btn btn-info"
            onClick={() => navigate(`/annonce/${currentProp.id}`)}
            title="Ouvrir la fiche complète"
          >
            <span>ℹ️</span>
          </button>
        </div>
      )}

      {/* ── CELEBRATION MODAL: IT'S A MATCH! ── */}
      {matchCelebration && (
        <div className="tinder-celebrate-backdrop" onClick={() => setMatchCelebration(null)}>
          <div className="tinder-celebrate-modal" onClick={e => e.stopPropagation()}>
            <div className="celebrate-confetti">✨ 👑 🏆 ✨</div>
            <h2 className="celebrate-title golden-title">C'est un Match Or !</h2>
            <div className="celebrate-score-glow golden-glow">
              <span className="celebrate-score-val">{matchCelebration.matchScore}%</span>
              <span className="celebrate-score-label">d'affinité exceptionnelle avec vos critères</span>
            </div>

            <div className="celebrate-card-preview">
              <img src={matchCelebration.img} alt="" className="celebrate-img" />
              <div className="celebrate-info">
                <h4>{matchCelebration.titre || `${matchCelebration.type} à Toulon`}</h4>
                <p className="celebrate-price">{matchCelebration.prix?.toLocaleString('fr-FR')} €</p>
                <p className="celebrate-district">📍 {matchCelebration.quartier} · {matchCelebration.surface} m²</p>
              </div>
            </div>

            <div className="celebrate-actions">
              <button
                className="celebrate-btn-main"
                onClick={() => {
                  setMatchCelebration(null);
                  navigate(`/annonce/${matchCelebration.id}`);
                }}
              >
                Consulter la fiche complète
              </button>
              {isLegacyDvfProperty(matchCelebration) ? (
                <a
                  href={getReportUrl(matchCelebration.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="celebrate-btn-pdf"
                >
                  Rapport d’expertise DVF
                </a>
              ) : getListingSourceUrl(matchCelebration) ? (
                <a
                  href={getListingSourceUrl(matchCelebration)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="celebrate-btn-pdf"
                >
                  Consulter l’annonce source
                </a>
              ) : null}
              <button
                className="celebrate-btn-continue"
                onClick={() => setMatchCelebration(null)}
              >
                Continuer à swiper
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCORE BREAKDOWN MODAL ── */}
      {scoreModalProp && (
        <div className="tinder-modal-backdrop" onClick={() => setScoreModalProp(null)}>
          <div className="tinder-modal-card" onClick={e => e.stopPropagation()}>
            <div className="tinder-modal-header">
              <div>
                <h3>Détail du Score IA ({scoreModalProp.matchScore}%)</h3>
                <p className="tinder-modal-sub">{scoreModalProp.titre || scoreModalProp.type} · {scoreModalProp.quartier}</p>
              </div>
              <button className="tinder-modal-close" onClick={() => setScoreModalProp(null)}>✕</button>
            </div>

            <div className="tinder-modal-body">
              <div className="score-criteria-list">
                {scoreModalProp.criteria?.map((c, i) => (
                  <div key={i} className="score-crit-item">
                    <div className="crit-item-top">
                      <span className="crit-label">{c.label}</span>
                      <span className="crit-pts"><strong>{c.pts}</strong> / {c.max} pts</span>
                    </div>
                    <div className="crit-bar-track">
                      <div
                        className="crit-bar-fill"
                        style={{
                          width: `${(c.pts / c.max) * 100}%`,
                          background: c.met ? '#10b981' : c.partial ? '#f59e0b' : '#ef4444'
                        }}
                      />
                    </div>
                    <div className="crit-detail">{c.detail}</div>
                  </div>
                ))}
              </div>

              {districtAvg && (
                <div className="market-benchmark-box">
                  <div className="benchmark-title">📊 Benchmark Marché {scoreModalProp.quartier}</div>
                  <div className="benchmark-row">
                    <span>Prix de ce bien :</span>
                    <strong>{Math.round(scoreModalProp.prixM2).toLocaleString('fr-FR')} €/m²</strong>
                  </div>
                  <div className="benchmark-row">
                    <span>Moyenne du quartier :</span>
                    <strong>{Math.round(districtAvg).toLocaleString('fr-FR')} €/m²</strong>
                  </div>
                  {undervalPct !== 0 && (
                    <div className="benchmark-verdict" style={{ color: undervalPct > 0 ? '#10b981' : '#ef4444' }}>
                      {undervalPct > 0
                        ? `✓ Opportunité : ${undervalPct}% moins cher que la moyenne quartier.`
                        : `⚠ Bien positionné à +${Math.abs(undervalPct)}% au-dessus de la moyenne.`}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="tinder-modal-footer">
              <button className="tinder-btn-primary" onClick={() => setScoreModalProp(null)}>
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
