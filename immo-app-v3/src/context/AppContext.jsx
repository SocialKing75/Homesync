import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchProperties,
  scoreProperties,
  fetchMarketDashboard,
  fetchStats,
  fetchKnnOpportunities,
  searchNationalProperties,
} from '../services/api';
import { recordClientActivity } from '../services/agencyWorkspace';

const AppContext = createContext();

// Suggestions nationales pour initier une recherche. Le chat accepte toute ville française.
export const LOCALISATIONS_FRANCE = [
  'Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Nantes', 'Lille',
  'Nice', 'Montpellier', 'Rennes', 'Strasbourg', 'Toulon', 'Aix-en-Provence',
  'La Rochelle', 'Annecy', 'Biarritz', 'Grenoble', 'Angers', 'Dijon', 'Tours',
];
export const QUARTIERS_TOULON = LOCALISATIONS_FRANCE;
export const QUARTIERS_LIST = LOCALISATIONS_FRANCE;

// Score basé sur les critères réels du profil (100 pts max) avec explication détaillée
export function computeScoreDetailed(annonce, profil) {
  // Si le backend a calculé un score combiné (relevance + market attractiveness), on peut l'intégrer
  const criteria = [];

  // Prix max (35 pts)
  let ptsP = 0;
  if (annonce.prix <= profil.prixMax) ptsP = 35;
  else if (annonce.prix <= profil.prixMax * 1.15) ptsP = 18;
  else if (annonce.prix <= profil.prixMax * 1.30) ptsP = 7;
  criteria.push({
    label: 'Budget',
    pts: ptsP, max: 35,
    met: ptsP === 35,
    partial: ptsP > 0 && ptsP < 35,
    detail: ptsP === 35
      ? `${annonce.prix.toLocaleString('fr-FR')} € ≤ ${profil.prixMax.toLocaleString('fr-FR')} €`
      : `${annonce.prix.toLocaleString('fr-FR')} € > ${profil.prixMax.toLocaleString('fr-FR')} €`,
  });

  // Quartier (25 pts)
  let ptsQ = 0;
  let quartierDetail = '';
  if (!profil.quartiers?.length) {
    ptsQ = 25; quartierDetail = 'Toute la France acceptée';
  } else {
    const qOk = profil.quartiers.some(q =>
      (annonce.quartier || annonce.ville || '').toLowerCase().includes(q.toLowerCase()) ||
      q.toLowerCase().includes((annonce.quartier || annonce.ville || '').toLowerCase())
    );
    ptsQ = qOk ? 25 : 0;
    quartierDetail = qOk ? `${annonce.quartier || annonce.ville} — dans votre sélection` : `${annonce.quartier || annonce.ville} — hors sélection`;
  }
  criteria.push({ label: 'Quartier', pts: ptsQ, max: 25, met: ptsQ === 25, partial: false, detail: quartierDetail });

  // Pièces (20 pts)
  const diff = Math.abs((annonce.pieces || annonce.nb_pieces || 1) - profil.pieces);
  const ptsR = diff === 0 ? 20 : diff === 1 ? 12 : diff === 2 ? 5 : 0;
  criteria.push({
    label: 'Pièces',
    pts: ptsR, max: 20,
    met: diff === 0, partial: diff > 0 && ptsR > 0,
    detail: `${annonce.pieces || annonce.nb_pieces || 1} pièce${(annonce.pieces || annonce.nb_pieces || 1) > 1 ? 's' : ''} — souhaité : ${profil.pieces}`,
  });

  // Type de bien (15 pts)
  const typeOk = profil.typeBien === 'Appartement'
    ? (annonce.type || '').toLowerCase().includes('appartement')
    : (annonce.type || '').toLowerCase().includes('maison');
  criteria.push({
    label: 'Type de bien',
    pts: typeOk ? 15 : 0, max: 15,
    met: typeOk, partial: false,
    detail: `${annonce.type} — souhaité : ${profil.typeBien}`,
  });

  // Achat / Location (5 pts)
  const alOk = profil.achatLocation === 'Achat / Location' || annonce.achatLocation === profil.achatLocation;
  criteria.push({
    label: 'Achat / Location',
    pts: alOk ? 5 : 0, max: 5,
    met: alOk, partial: false,
    detail: annonce.achatLocation,
  });

  const total = Math.min(100, criteria.reduce((s, c) => s + c.pts, 0));
  return { criteria, total };
}

export function computeScore(annonce, profil) {
  // If backend scored this annonce, respect the backend combined score if available
  if (typeof annonce.backend_score === 'number') {
    return Math.round(annonce.backend_score);
  }
  return computeScoreDetailed(annonce, profil).total;
}

const DEFAULT_PROFIL = {
  pieces: 3,
  quartiers: [],
  prixMax: 350000,
  mensualiteMax: 1200,
  typeBien: 'Appartement',
  achatLocation: 'Achat',
  environnement: ['Ville'],
};

export function AppProvider({ children }) {
  const [user, setUser] = useState({ nom: 'Marc Ivan', email: 'mariojaris2@gmail.com', profil: 'Agent' });
  const [favoris, setFavoris] = useState(() => {
    try { return JSON.parse(localStorage.getItem('immo_favoris') || '[]'); }
    catch { return []; }
  });
  const [annonces, setAnnonces] = useState([]);
  const [activeSearch, setActiveSearch] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('homesync_active_search') || 'null'); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(false);
  const [marketStats, setMarketStats] = useState(null);
  const [marketDashboard, setMarketDashboard] = useState(null);
  const [knnOpportunities, setKnnOpportunities] = useState([]);

  const [theme, setTheme] = useState('light');
  const [profil, setProfil] = useState(() => {
    try { return JSON.parse(localStorage.getItem('immo_profil') || 'null') || DEFAULT_PROFIL; }
    catch { return DEFAULT_PROFIL; }
  });

  // Load all initial dataset from backend API
  const loadData = useCallback(async (profileForScoring = DEFAULT_PROFIL) => {
    setLoading(true);
    try {
      const [nationalData, propsData, statsData, dashData, knnData] = await Promise.allSettled([
        searchNationalProperties(),
        fetchProperties(),
        fetchStats(),
        fetchMarketDashboard(),
        fetchKnnOpportunities(),
      ]);

      let loadedProps = [];
      if (nationalData.status === 'fulfilled' && nationalData.value.length) {
        loadedProps = nationalData.value;
        setApiOnline(true);
      } else if (propsData.status === 'fulfilled') {
        loadedProps = propsData.value;
        setApiOnline(true);
      } else {
        console.warn('Could not load listings from the backend.');
      }

      if (statsData.status === 'fulfilled') setMarketStats(statsData.value);
      if (dashData.status === 'fulfilled') setMarketDashboard(dashData.value);
      if (knnData.status === 'fulfilled') setKnnOpportunities(knnData.value);

      // The national matching route requires a verified session. Until then the
      // client score keeps the public catalogue explorable.
      if (loadedProps.length > 0) {
        try {
          const scoredResults = nationalData.status === 'fulfilled' ? [] : await scoreProperties(profileForScoring);
          if (Array.isArray(scoredResults) && scoredResults.length > 0) {
            const scoreMap = new Map(scoredResults.map(s => [s.id, s]));
            loadedProps = loadedProps.map(p => {
              const scored = scoreMap.get(p.id);
              if (scored) {
                return {
                  ...p,
                  score: scored.score,
                  backend_score: scored.score,
                  backend_relevance: scored.backend_relevance,
                  backend_market_score: scored.backend_market_score,
                };
              }
              return p;
            });
          }
        } catch (scoreErr) {
          console.warn('⚠️ [Frontend] Backend scoring failed, using client heuristic:', scoreErr);
        }
      }

      setAnnonces(loadedProps);
    } catch (err) {
      console.error('❌ [Frontend] Global data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleFavori = (annonce) => {
    const wasFavorite = favoris.some((favorite) => favorite.id === annonce.id);
    setFavoris(prev =>
      prev.find(f => f.id === annonce.id)
        ? prev.filter(f => f.id !== annonce.id)
        : [...prev, annonce]
    );
    recordClientActivity({ type: wasFavorite ? 'selection_removed' : 'selection_added', annonce, clientName: user?.nom || 'Marc Ivan' });
  };

  const isFavori = (id) => favoris.some(f => f.id === id);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  // LocalStorage persistance
  useEffect(() => { localStorage.setItem('immo_favoris', JSON.stringify(favoris)); }, [favoris]);
  useEffect(() => { localStorage.setItem('immo_profil',  JSON.stringify(profil));  }, [profil]);
  useEffect(() => {
    if (activeSearch) sessionStorage.setItem('homesync_active_search', JSON.stringify(activeSearch));
    else sessionStorage.removeItem('homesync_active_search');
  }, [activeSearch]);

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        favoris,
        toggleFavori,
        isFavori,
        profil,
        setProfil,
        annonces,
        setAnnonces,
        activeSearch,
        setActiveSearch,
        theme,
        toggleTheme,
        loading,
        apiOnline,
        marketStats,
        marketDashboard,
        knnOpportunities,
        refreshData: loadData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
