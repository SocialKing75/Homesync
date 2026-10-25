import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, computeScore } from '../context/AppContext';
import { getReportUrl } from '../services/api';
import HomeSyncLogo from '../components/HomeSyncLogo';
import LandingChat from '../components/LandingChat';
import InteractiveMap from '../components/InteractiveMap';
import PropertyDetailBreakdown from '../components/PropertyDetailBreakdown';
import InviteModal from '../components/InviteModal';
import AgenceMessageModal from '../components/AgenceMessageModal';
import './Login.css';

const POPULAR_QUARTIERS = [
  { label: 'Paris', full: 'Paris' }, { label: 'Lyon', full: 'Lyon' },
  { label: 'Marseille', full: 'Marseille' }, { label: 'Bordeaux', full: 'Bordeaux' },
  { label: 'Nantes', full: 'Nantes' }, { label: 'Toulouse', full: 'Toulouse' },
  { label: 'Nice', full: 'Nice' },
];

export default function Login() {
  const { annonces, profil, setProfil, favoris, isFavori, toggleFavori, apiOnline, setUser } = useApp();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState('explore');
  const [targetQuartier, setTargetQuartier] = useState('France');
  const [selectedAnnonce, setSelectedAnnonce] = useState(null);
  const [inspectionAnnonce, setInspectionAnnonce] = useState(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // Collaboration State (Inspired by Reference)
  const [coUsers, setCoUsers] = useState([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [agencyModalAnnonce, setAgencyModalAnnonce] = useState(null);

  // Scored properties with coordinates
  const scoredAnnonces = useMemo(() => {
    return annonces.map(a => {
      const lng = Number(a.lng);
      const lat = Number(a.lat);
      const hasExactLocation = Number.isFinite(lng) && Number.isFinite(lat)
        && lng >= -6 && lng <= 10 && lat >= 41 && lat <= 52;
      // Never invent a Toulon fallback for a national listing: a marker is only
      // displayed when its source provides a real French coordinate pair.
      if (!hasExactLocation) return null;
      const score = computeScore(a, profil);
      return {
        ...a,
        score,
        matchScore: score,
        lng,
        lat,
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
  }, [annonces, profil]);

  const goldenMatchCount = useMemo(() => {
    return scoredAnnonces.filter(a => a.score >= 75).length;
  }, [scoredAnnonces]);

  const handleQuartierChipClick = (qFull) => {
    setTargetQuartier(qFull);
    setProfil(prev => ({
      ...prev,
      quartiers: [qFull]
    }));
  };

  const handleChatSearchUpdate = (newProfil) => {
    setProfil(newProfil);
    if (newProfil.quartiers?.[0]) {
      setTargetQuartier(newProfil.quartiers[0]);
    }
  };

  const handleOpenDetail = (id) => {
    setUser(prev => ({
      ...prev,
      nom: prev?.nom || 'Marc Ivan',
      email: prev?.email || 'mariojaris2@gmail.com',
      profil: 'Acheteur',
    }));
    navigate(`/bien/${encodeURIComponent(id)}`);
  };

  return (
    <div className="unified-landing-root">
      <header className="workspace-nav">
        <button className="workspace-brand" onClick={() => navigate('/')} aria-label="Retour à l’accueil HomeSync"><HomeSyncLogo /></button>
        <div className="workspace-project"><small>PROJET ACTIF</small><strong>Mon prochain chez-moi</strong></div>
        <nav className="workspace-links"><button className="active">Recherche</button><button onClick={() => navigate('/matching')}>Correspondances</button><button onClick={() => navigate('/favoris')}>Favoris{favoris.length ? ` (${favoris.length})` : ''}</button><button onClick={() => navigate('/messages')}>Messages</button></nav>
        <div className="workspace-people"><span className="workspace-avatar primary">M</span>{coUsers.slice(0, 1).map(u => <span className="workspace-avatar" key={u.name}>{u.name[0]}</span>)}<button onClick={() => setIsInviteOpen(true)}>Inviter</button></div>
      </header>

      {/* ═══════ MAIN CONTENT AREA ═══════ */}
      {viewMode === 'tinder' ? (
        /* ── TINDER MATCHER FULL VIEW ── */
        <div className="landing-tinder-wrapper">
          <div className="tinder-nav-banner">
            <button
              className="back-to-explore-btn"
              onClick={() => setViewMode('explore')}
            >
              Retour à la conversation
            </button>
            <span className="tinder-banner-golden-note">
              Les biens prioritaires sont mis en avant dans cette sélection
            </span>
          </div>
        </div>
      ) : (
        /* ── CHAT & MAP UNIFIED WORKSPACE (ON THE SAME PAGE) ── */
        <main className={`landing-workspace ${isMapExpanded ? 'map-only-expanded' : ''}`}>
          {/* LEFT: CONVERSATIONAL CHAT OR PROPERTY DETAIL BREAKDOWN (Screenshot 3) */}
          {!isMapExpanded && (
            <aside className="workspace-chat-pane">
              {inspectionAnnonce ? (
                <PropertyDetailBreakdown
                  annonce={inspectionAnnonce}
                  onBack={() => setInspectionAnnonce(null)}
                  coUsers={coUsers}
                  isFavori={isFavori(inspectionAnnonce.id)}
                  onToggleFavori={() => toggleFavori(inspectionAnnonce)}
                  onRequestVisit={() => {
                    setAgencyModalAnnonce(inspectionAnnonce);
                    setIsAgencyModalOpen(true);
                  }}
                  onOpenTinder={() => navigate('/matching')}
                />
              ) : (
                <LandingChat
                  onQuartierSelect={(q) => setTargetQuartier(q)}
                  onSearchUpdate={handleChatSearchUpdate}
                  onLaunchMatching={(tab) => {
                    if (tab === 'tinder') navigate('/matching');
                    else navigate('/recherche');
                  }}
                  coUsers={coUsers}
                  onOpenInvite={() => setIsInviteOpen(true)}
                  onOpenContactAgency={(a) => {
                    setAgencyModalAnnonce(a);
                    setIsAgencyModalOpen(true);
                  }}
                />
              )}
            </aside>
          )}

          {/* RIGHT: INTERACTIVE MAP (LINKED TO CHAT) */}
          <section className={`workspace-map-pane ${isMapExpanded ? 'pane-expanded' : ''}`}>
            {/* Top Map Context Pill */}
            <div className="map-context-floating-bar">
              <span className="mcf-title">
                Secteur actif : <strong>{targetQuartier ? targetQuartier.split('-')[0] : 'France'}</strong>
              </span>
              <span className="mcf-count">
                {scoredAnnonces.length} biens indexés · {goldenMatchCount} priorités
              </span>
              <button
                className="mcf-tinder-quick-btn"
                onClick={() => navigate('/matching')}
              >
                Voir la sélection
              </button>
            </div>

            <InteractiveMap
              annonces={scoredAnnonces}
              targetQuartier={targetQuartier}
              selectedAnnonce={selectedAnnonce}
              onSelectAnnonce={(a) => {
                setSelectedAnnonce(a);
              }}
              isExpanded={isMapExpanded}
              onToggleExpand={() => setIsMapExpanded(prev => !prev)}
              coUsers={coUsers}
            />

            {/* FLOATING GOLDEN PREVIEW CARD WHEN ANNONCE IS CLICKED */}
            {selectedAnnonce && !inspectionAnnonce && (
              <div className="map-selected-golden-card">
                <button
                  className="card-close-x"
                  onClick={() => setSelectedAnnonce(null)}
                >
                  ✕
                </button>

                <div className="preview-card-img-wrap">
                  <img
                    src={selectedAnnonce.img}
                    alt={selectedAnnonce.titre || selectedAnnonce.type}
                    className="preview-card-img"
                  />
                  <div className="preview-golden-badge">
                    <span className="score-text">{selectedAnnonce.score}% COMPATIBILITÉ</span>
                  </div>
                  <button
                    className={`preview-heart-btn ${isFavori(selectedAnnonce.id) ? 'active' : ''}`}
                    onClick={() => toggleFavori(selectedAnnonce)}
                    title={isFavori(selectedAnnonce.id) ? 'Retirer' : 'Ajouter aux favoris'}
                  >
                    ♥
                  </button>
                </div>

                <div className="preview-card-body">
                  <div className="preview-price-row">
                    <span className="preview-price">{selectedAnnonce.prix?.toLocaleString('fr-FR')} €</span>
                    <span className="preview-pm2">{selectedAnnonce.prixM2?.toLocaleString('fr-FR')} €/m²</span>
                  </div>

                  <h4 className="preview-title">
                    {selectedAnnonce.titre || `${selectedAnnonce.type} ${selectedAnnonce.pieces} pièces`}
                  </h4>

                  <div className="preview-meta-chips">
                    <span>{selectedAnnonce.quartier}</span>
                    <span>{selectedAnnonce.surface} m²</span>
                    <span>{selectedAnnonce.pieces} p.</span>
                    <span>{selectedAnnonce.etage || 'RDC'}</span>
                  </div>

                  <div className="preview-actions">
                    <button
                      id="btn-inspect-accord"
                      className="preview-btn-inspect"
                      onClick={() => setInspectionAnnonce(selectedAnnonce)}
                      title="Inspecter le compromis et les critères côte à côte"
                    >
                      Analyser le bien
                    </button>
                    <button
                      className="preview-btn-main"
                      onClick={() => handleOpenDetail(selectedAnnonce.id)}
                    >
                      Fiche complète
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* ── MODALS (Collaborative Invite & Agency Visit Request) ── */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInviteSuccess={(name) => {
          setCoUsers(prev => {
            const exists = prev.some(u => u.name.toLowerCase() === name.toLowerCase());
            return exists ? prev : [...prev, { name, active: true }];
          });
        }}
      />

      <AgenceMessageModal
        isOpen={isAgencyModalOpen}
        onClose={() => setIsAgencyModalOpen(false)}
        annonce={agencyModalAnnonce}
        coUsers={coUsers}
      />
    </div>
  );
}
