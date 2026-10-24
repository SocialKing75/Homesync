import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Navbar from '../components/Navbar';
import Dashboard from '../components/Dashboard';
import { useApp, computeScore } from '../context/AppContext';
import './Accueil.css';

/* ── Mapbox Token (immo-app-v3/.env.local, non versionné) ── */
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

/* ── Quartier coords [lng, lat] ── */
const QUARTIER_COORDS = {
  'Mourillon':         [5.9370, 43.1186],
  'Centre-Ville':      [5.9280, 43.1242],
  'Centre-ville':      [5.9280, 43.1242],
  'Saint-Jean du Var': [5.9380, 43.1290],
  'La Rode':           [5.9220, 43.1320],
  'Pont du Las':       [5.9180, 43.1380],
  'Le Pradet':         [5.9980, 43.1060],
  'La Seyne':          [5.8810, 43.1010],
  'Siblas':            [5.9100, 43.1350],
  'Saint-Roch':        [5.9300, 43.1200],
  'Aguillon':          [5.9150, 43.1350],
  'Barbès':            [5.9250, 43.1400],
  'Beaulieu':          [5.9450, 43.1100],
  'Bon Rencontre':     [5.9100, 43.1450],
  'Bonfante-Florane':  [5.9350, 43.1380],
  'Brunet':            [5.9500, 43.1280],
  'Champs-de-Mars':    [5.9320, 43.1320],
  'Claret':            [5.9200, 43.1250],
  'Corniche du Faron': [5.9600, 43.1100],
  'Darboussèdes':      [5.9150, 43.1200],
  'Font Pré':          [5.9400, 43.1350],
  'Haute-ville':       [5.9280, 43.1300],
  'Jonquet - Guynemer':[5.9350, 43.1450],
  'La Loubière':       [5.9280, 43.1150],
  'La Palasse':        [5.9180, 43.1150],
  'La Serinette - La Barre': [5.9200, 43.1180],
  'Le Mourillon - La Mitre - Fort Lamalgue': [5.9370, 43.1186],
  'Le Port':           [5.9280, 43.1180],
  'Les Lices':         [5.9280, 43.1270],
  'Les Quatre Chemins': [5.9150, 43.1300],
  'Les Routes':        [5.9250, 43.1350],
  'L\'Escaillon':      [5.9300, 43.1400],
  'Place d\'Armes':    [5.9310, 43.1245],
  'Pont de Bois':      [5.9350, 43.1150],
  'Pont de Suve':      [5.9400, 43.1200],
  'Porte d\'Italie':   [5.9250, 43.1100],
  'Rodeilhac':         [5.9180, 43.1300],
  'Sainte-Anne':       [5.9350, 43.1250],
  'Ubac - Dardennes - Barbasse - Mont Faron': [5.9350, 43.1400],
  'Valbertrand':       [5.9200, 43.1100],
  'Valbourdin':        [5.9150, 43.1100],
};

/* ── Quartier stats (fallback values for all quartiers) ── */
const QUARTIER_STATS = {
  'Mourillon':         { prixM2: 4800, evol12m: 6.1,  delaiMois: 2.8, volume: 112, rendement: 3.2 },
  'Centre-Ville':      { prixM2: 4120, evol12m: 4.2,  delaiMois: 3.1, volume: 134, rendement: 4.1 },
  'Centre-ville':      { prixM2: 4120, evol12m: 4.2,  delaiMois: 3.1, volume: 134, rendement: 4.1 },
  'Saint-Jean du Var': { prixM2: 3680, evol12m: 4.8,  delaiMois: 3.4, volume: 78,  rendement: 4.5 },
  'La Rode':           { prixM2: 3420, evol12m: 2.9,  delaiMois: 3.6, volume: 65,  rendement: 4.8 },
  'Pont du Las':       { prixM2: 3180, evol12m: -0.5, delaiMois: 3.9, volume: 54,  rendement: 5.2 },
  'Le Pradet':         { prixM2: 3050, evol12m: 5.7,  delaiMois: 3.2, volume: 42,  rendement: 4.0 },
  'La Seyne':          { prixM2: 2890, evol12m: -0.3, delaiMois: 4.1, volume: 98,  rendement: 5.8 },
  'Siblas':            { prixM2: 2640, evol12m: -1.6, delaiMois: 4.5, volume: 60,  rendement: 6.1 },
  'Saint-Roch':        { prixM2: 3500, evol12m: 3.2,  delaiMois: 3.3, volume: 85,  rendement: 4.3 },
  'Le Mourillon - La Mitre - Fort Lamalgue': { prixM2: 4800, evol12m: 6.1, delaiMois: 2.8, volume: 112, rendement: 3.2 },
  'Porte d\'Italie':   { prixM2: 3200, evol12m: 2.1,  delaiMois: 3.5, volume: 70,  rendement: 4.6 },
  'Aguillon':          { prixM2: 3100, evol12m: 1.5,  delaiMois: 3.7, volume: 60,  rendement: 5.1 },
  'Barbès':            { prixM2: 3300, evol12m: 2.8,  delaiMois: 3.4, volume: 75,  rendement: 4.5 },
  'Beaulieu':          { prixM2: 3800, evol12m: 4.5,  delaiMois: 3.0, volume: 90,  rendement: 4.0 },
  'Bon Rencontre':     { prixM2: 2950, evol12m: 1.2,  delaiMois: 4.0, volume: 55,  rendement: 5.3 },
  'Bonfante-Florane':  { prixM2: 3400, evol12m: 3.1,  delaiMois: 3.3, volume: 80,  rendement: 4.4 },
  'Brunet':            { prixM2: 3600, evol12m: 3.8,  delaiMois: 3.2, volume: 95,  rendement: 4.2 },
  'Champs-de-Mars':    { prixM2: 3700, evol12m: 4.0,  delaiMois: 3.1, volume: 100, rendement: 4.1 },
  'Claret':            { prixM2: 3250, evol12m: 2.5,  delaiMois: 3.5, volume: 70,  rendement: 4.6 },
  'Corniche du Faron': { prixM2: 5100, evol12m: 7.2,  delaiMois: 2.5, volume: 120, rendement: 3.0 },
  'Darboussèdes':      { prixM2: 3150, evol12m: 2.0,  delaiMois: 3.6, volume: 65,  rendement: 4.7 },
  'Font Pré':          { prixM2: 3450, evol12m: 3.3,  delaiMois: 3.3, volume: 85,  rendement: 4.3 },
  'Haute-ville':       { prixM2: 3900, evol12m: 4.6,  delaiMois: 3.0, volume: 105, rendement: 4.0 },
  'Jonquet - Guynemer':{ prixM2: 3000, evol12m: 1.8,  delaiMois: 3.8, volume: 60,  rendement: 5.2 },
  'La Loubière':       { prixM2: 3550, evol12m: 3.5,  delaiMois: 3.2, volume: 90,  rendement: 4.2 },
  'La Palasse':        { prixM2: 3350, evol12m: 2.7,  delaiMois: 3.4, volume: 75,  rendement: 4.5 },
  'La Serinette - La Barre': { prixM2: 3300, evol12m: 2.8, delaiMois: 3.4, volume: 75, rendement: 4.5 },
  'Le Port':           { prixM2: 3750, evol12m: 4.2,  delaiMois: 3.1, volume: 95,  rendement: 4.1 },
  'Les Lices':         { prixM2: 4000, evol12m: 4.8,  delaiMois: 2.9, volume: 110, rendement: 3.9 },
  'Les Quatre Chemins': { prixM2: 3050, evol12m: 1.9, delaiMois: 3.7, volume: 65, rendement: 5.0 },
  'Les Routes':        { prixM2: 3200, evol12m: 2.3,  delaiMois: 3.5, volume: 70,  rendement: 4.6 },
  'L\'Escaillon':      { prixM2: 3400, evol12m: 3.0,  delaiMois: 3.3, volume: 80,  rendement: 4.4 },
  'Place d\'Armes':    { prixM2: 4100, evol12m: 4.9,  delaiMois: 2.9, volume: 115, rendement: 3.8 },
  'Pont de Bois':      { prixM2: 3500, evol12m: 3.2,  delaiMois: 3.3, volume: 85,  rendement: 4.3 },
  'Pont de Suve':      { prixM2: 3600, evol12m: 3.7,  delaiMois: 3.2, volume: 90,  rendement: 4.2 },
  'Rodeilhac':         { prixM2: 3100, evol12m: 1.7,  delaiMois: 3.8, volume: 60,  rendement: 5.1 },
  'Sainte-Anne':       { prixM2: 3800, evol12m: 4.4,  delaiMois: 3.0, volume: 100, rendement: 4.0 },
  'Ubac - Dardennes - Barbasse - Mont Faron': { prixM2: 2800, evol12m: 0.8, delaiMois: 4.2, volume: 55, rendement: 5.5 },
  'Valbertrand':       { prixM2: 3000, evol12m: 1.5,  delaiMois: 3.9, volume: 55,  rendement: 5.2 },
  'Valbourdin':        { prixM2: 2950, evol12m: 1.3,  delaiMois: 4.0, volume: 55,  rendement: 5.3 },
};

const fmtPrix = v => v >= 1000000
  ? `${(v / 1000000).toFixed(1).replace('.0', '')}M`
  : `${Math.round(v / 1000)}K`;

/* ═══════ MAP COMPONENT ═══════ */
function FullMap({ annonces, onSelectAnnonce }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (mapRef.current) return;
    console.log('Initializing Mapbox map with token:', mapboxgl.accessToken?.slice(0, 20) + '...');
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [5.9300, 43.1250],
      zoom: 12.2,
      minZoom: 11.5,
      maxBounds: [
        [5.820, 43.080], // South West
        [6.030, 43.160]  // North East
      ],
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });
    map.on('error', (e) => console.error('Mapbox error:', e));
    map.on('load', () => console.log('Mapbox loaded successfully'));
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    map.on('load', async () => {
      // 1. LISIBILITÉ DES NOMS
      const style = map.getStyle();
      if (!style || !style.layers) {
        console.warn('Mapbox style or layers not fully loaded');
        // We continue because we still want to add the GEOJSON sources!
      }

      const layers = style?.layers || [];
      let firstSymbolId;
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol' && !firstSymbolId) { firstSymbolId = layers[i].id; }
        if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) {
          map.setPaintProperty(layers[i].id, 'text-color', '#111111');
          map.setPaintProperty(layers[i].id, 'text-halo-color', '#ffffff');
          map.setPaintProperty(layers[i].id, 'text-halo-width', 2);
        }
      }

      try {
        // Fetch geojson
        const [resIris, resCommune] = await Promise.all([
          fetch('https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-france-iris/exports/geojson?where=com_code%3D%2283137%22').then(r => r.json()),
          fetch('https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/communes.geojson').then(r => r.json())
        ]);

        const outlineFeatures = resCommune.features.filter(f => f.properties.code === '83137');
        const outlineData = { type: 'FeatureCollection', features: outlineFeatures };

        // Enrich IRIS data with random prices to match Python script visual logic
        resIris.features.forEach((feature, i) => {
          feature.properties.nom_affichage = feature.properties.iris_name || feature.properties.nom || `Quartier ${i}`;
          feature.properties.Prix_m2_Moyen = Math.floor(Math.random() * (7800 - 2800) + 2800);
          feature.properties.Tendance = (Math.random() * 6 - 1).toFixed(1);
        });

        // Add Sources
        map.addSource('iris', { 'type': 'geojson', 'data': resIris, 'generateId': true });
        map.addSource('outline', { 'type': 'geojson', 'data': outlineData });

        const priceColorScale = [
          'interpolate', ['linear'], ['get', 'Prix_m2_Moyen'],
          2800, '#ffedd5', // Orange très clair
          4000, '#fdba74', // Orange clair
          5000, '#f97316', // Orange moyen
          6500, '#ea580c', // Orange fort
          8000, '#9a3412'  // Orange sombre
        ];

        // Add Layers
        map.addLayer({
          'id': 'iris-fills', 'type': 'fill', 'source': 'iris',
          'paint': { 'fill-color': priceColorScale, 'fill-opacity': 0.85 }
        }, firstSymbolId);

        map.addLayer({
          'id': 'iris-borders', 'type': 'line', 'source': 'iris',
          'paint': { 'line-color': '#ffffff', 'line-width': 1 }
        }, firstSymbolId);

        map.addLayer({
          'id': 'iris-borders-hover', 'type': 'line', 'source': 'iris',
          'paint': {
            'line-color': '#000000',
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 3, 0]
          }
        }, firstSymbolId);

        map.addLayer({
          'id': 'city-outline', 'type': 'line', 'source': 'outline',
          'paint': { 'line-color': '#000000', 'line-width': 4 }
        }, firstSymbolId);

        let hoveredStateId = null;
        map.on('mousemove', 'iris-fills', (e) => {
          if (e.features.length > 0) {
            if (hoveredStateId !== null) { map.setFeatureState({ source: 'iris', id: hoveredStateId }, { hover: false }); }
            hoveredStateId = e.features[0].id;
            map.setFeatureState({ source: 'iris', id: hoveredStateId }, { hover: true });
          }
        });
        map.on('mouseleave', 'iris-fills', () => {
          if (hoveredStateId !== null) { map.setFeatureState({ source: 'iris', id: hoveredStateId }, { hover: false }); }
          hoveredStateId = null;
        });
      } catch (err) {
        console.error("Error loading geojson layers", err);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    annonces.forEach(a => {
      const price = fmtPrix(a.prix);
      const el = document.createElement('div');
      el.className = 'price-bubble';
      el.innerHTML = `<span class="pb-price">${price} €</span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); onSelectAnnonce(a); });

      try {
        if (!mapRef.current) return;
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([a.lng, a.lat])
          .addTo(mapRef.current);
        markersRef.current.push(marker);
      } catch (err) {
        // Ignorer silencieusement l'erreur asynchrone générée par le Hot Module Reloading (HMR) de React.
        // MapboxJS perd `appendChild` si le composant a été démonté avant l'injection des marqueurs.
      }
    });
  }, [annonces, onSelectAnnonce]);

  return (
    <>
      <div ref={containerRef} className="full-map" />
    </>
  );
}

/* ═══════ MAIN COMPONENT ═══════ */
export default function Accueil() {
  const { annonces, profil } = useApp();
  const navigate = useNavigate();

  console.log('🚀 Accueil component loaded. Annonces:', annonces?.length || 0, 'Profil:', profil);

  const [tab, setTab] = useState('carte');
  const [selected, setSelected] = useState(null);

  const scored = useMemo(
    () => annonces.map(a => ({ ...a, score: computeScore(a, profil) })).sort((a, b) => b.score - a.score),
    [annonces, profil]
  );

  const withCoords = useMemo(() => scored.map(a => {
    const base = QUARTIER_COORDS[a.quartier] || [5.928, 43.124];
    return { ...a, lng: base[0] + (Math.random() - 0.5) * 0.008, lat: base[1] + (Math.random() - 0.5) * 0.006 };
  }), [scored]);

  const handleSelect = useCallback((a) => setSelected(a), []);

  /* Dynamic List computations */
  const listStats = useMemo(() => {
    if (!withCoords.length) return { prixM2: 0, evol12m: 0, delaiMois: 0, rendement: 0 };
    const avgPrix = withCoords.reduce((acc, a) => acc + a.prixM2, 0) / withCoords.length;
    return {
      prixM2: Math.round(avgPrix),
      evol12m: 4.2, // Stats simulées pour la moyenne ville
      delaiMois: 3.1,
      rendement: 4.5
    };
  }, [withCoords]);

  /* Quartier of selected annonce or default to Search Scope */
  const qNameSafe = selected?.quartier ? selected.quartier.split(',')[0].trim() : null;
  const activeQ = qNameSafe || 'Recherche Active';
  const qStats = qNameSafe && QUARTIER_STATS[qNameSafe] ? QUARTIER_STATS[qNameSafe] : listStats;

  /* Dynamic trend graph computations (12 months span from qStats) */
  const trendData = useMemo(() => {
    const currentPrice = qStats.prixM2 || 0;
    const evol = qStats.evol12m || 0; // percentage
    const pastPrice = currentPrice / (1 + (evol / 100));
    
    // Deterministic jitter based on price to make the graph look alive but stable
    const p1 = pastPrice;
    const p2 = pastPrice + (currentPrice - pastPrice) * 0.2 + (currentPrice % 40);
    const p3 = pastPrice + (currentPrice - pastPrice) * 0.4 - (currentPrice % 30);
    const p4 = pastPrice + (currentPrice - pastPrice) * 0.6 + (currentPrice % 50);
    const p5 = pastPrice + (currentPrice - pastPrice) * 0.8 - (currentPrice % 20);
    const p6 = currentPrice;

    return [
      { month: 'Jan', val: p1 },
      { month: 'Mar', val: p2 },
      { month: 'Mai', val: p3 },
      { month: 'Jul', val: p4 },
      { month: 'Sep', val: p5 },
      { month: 'Nov', val: p6 },
    ];
  }, [qStats.prixM2, qStats.evol12m]);

  /* Undervaluation */
  const getUnderval = (a) => {
    const qs = QUARTIER_STATS[a.quartier];
    if (!qs || !a.surface) return 0;
    return Math.round(((qs.prixM2 * a.surface - a.prix) / (qs.prixM2 * a.surface)) * 100);
  };

  return (
    <div className="accueil-root">
      <Navbar />

      {/* ── Tab bar (floating) ── */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'analyses' ? 'active' : ''}`} onClick={() => setTab('analyses')}>Analyses</button>
        <button className={`tab-btn ${tab === 'opportunites' ? 'active' : ''}`} onClick={() => setTab('opportunites')}>Opportunités et k-NN</button>
        <button className={`tab-btn ${tab === 'carte' ? 'active' : ''}`} onClick={() => setTab('carte')}>Carte</button>
      </div>

      {/* ═══ CARTE TAB ═══ */}
      {tab === 'carte' && (
        <div className="carte-fullscreen">
          <FullMap annonces={withCoords} onSelectAnnonce={handleSelect} />

          {/* Floating left panel — quartier stats */}
          <div className="overlay-left">
            <div className="ol-quartier">{activeQ}</div>
            <div className="ol-row">
              <div className="ol-prix">{qStats.prixM2.toLocaleString('fr-FR')} €/m²</div>
              <div className={`ol-badge ${qStats.evol12m >= 0 ? 'badge-green' : 'badge-red'}`}>
                {qStats.evol12m >= 0 ? '+' : ''}{qStats.evol12m}% sur 12 mois
              </div>
            </div>
            <div className="ol-delai">{qStats.delaiMois} mois en moyenne</div>

            {/* Mini chart interactive */}
            <div className="ol-chart" style={{ width: '100%', height: '60px', marginBottom: '16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--neon-orange)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--neon-orange)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="val" 
                    stroke="var(--neon-orange)" 
                    strokeWidth={3} 
                    fill="url(#trendGradient)" 
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="ol-chart-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8', fontWeight: 600, marginTop: '4px' }}>
                {trendData.map(d => <span key={d.month}>{d.month}</span>)}
              </div>
            </div>

            {/* Filter pills */}
            <div className="ol-filters">
              <span className="ol-pill">Budget Max: {(profil.prixMax / 1000).toFixed(0)}k€</span>
              <span className="ol-pill">{withCoords.length} annonces</span>
              <span className="ol-pill">{profil.typeBien}</span>
              <span className="ol-pill">{profil.achatLocation}</span>
            </div>
          </div>

          {/* Floating right panel — Feed or Selected Detail */}
          {selected ? (
            <div className="overlay-right mode-detail">
              <button className="or-close" onClick={() => setSelected(null)}>x</button>
              <div className="or-logo-row">
                <img src="/logo-toulon-ai.svg" alt="" className="or-logo" />
              </div>
              <img src={selected.img} alt="" className="or-img" />

              <div className="or-type">{selected.type} · {selected.quartier}</div>
              <div className="or-meta">{selected.surface} m² · {selected.pieces} Pièces</div>

              <div className="or-price-row">
                <div className="or-price">{selected.prix.toLocaleString('fr-FR')} €</div>
                <div className="or-score">{(selected.score / 100 * 5).toFixed(2)}/100</div>
              </div>

              {(() => {
                const uv = getUnderval(selected);
                return (
                  <div className={`or-invest ${uv > 5 ? 'invest-good' : uv < -5 ? 'invest-bad' : 'invest-ok'}`}>
                    {uv > 5 ? 'Bon investissement' : uv < -5 ? 'Prix au-dessus du marché' : 'Prix cohérent'}
                  </div>
                );
              })()}

              {/* Progress bar */}
              <div className="or-bar-track">
                <div className="or-bar-fill" style={{ width: `${selected.score}%` }} />
              </div>

              <div className="or-details">
                <span>Étage {selected.etage || 'RDC'}</span>
                <span>{selected.prixM2?.toLocaleString('fr-FR')}€/m²</span>
              </div>

              <button className="or-cta" onClick={() => navigate(`/annonce/${selected.id}`)}>
                Voir l'opportunité
              </button>
            </div>
          ) : (
            <div className="overlay-right mode-list" style={{ overflowY: 'auto', padding: 0 }}>
              <div className="feed-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', padding: '20px', borderBottom: '1px solid var(--border-color)', zIndex: 10 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-color)' }}>{withCoords.length} annonces pertinentes</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Triez et filtrez via votre profil</p>
              </div>
              <div className="feed-list" style={{ display: 'flex', flexDirection: 'column', padding: '12px', gap: '12px' }}>
                {withCoords.map(a => (
                  <div 
                    key={a.id} 
                    className="feed-card" 
                    onClick={() => setSelected(a)} 
                    style={{ 
                      display: 'flex', gap: '12px', padding: '12px', 
                      background: 'var(--bg-body)', borderRadius: '12px', cursor: 'pointer', 
                      border: '1px solid var(--border-color)', transition: 'all 0.2s', 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)' 
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--neon-orange)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    }}
                  >
                    <img src={a.img} alt="" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-color)' }}>{a.prix.toLocaleString('fr-FR')} €</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0' }}>{a.surface} m² · {a.type.split(' ')[0]}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.quartier.split(',')[0]}</div>
                      <div style={{ marginTop: 'auto', fontSize: '0.75rem', fontWeight: 700, color: 'var(--neon-orange)' }}>
                        ★ {(a.score / 100 * 5).toFixed(1)} / 5
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ ANALYSES & OPPORTUNITES TAB ═══ */}
      {(tab === 'analyses' || tab === 'opportunites') && (
        <div className="analyse-wrapper">
          <Dashboard forcedTab={tab} />
        </div>
      )}
    </div>
  );
}
