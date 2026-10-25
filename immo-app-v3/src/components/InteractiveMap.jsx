import { useState, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './InteractiveMap.css';

/* ── Mapbox Token Check ── */
const envToken = import.meta.env.VITE_MAPBOX_TOKEN;
const hasValidMapboxToken = Boolean(
  envToken &&
  envToken.startsWith('pk.') &&
  !envToken.includes('votre_token')
);
if (hasValidMapboxToken) {
  mapboxgl.accessToken = envToken;
}

const OSM_STYLE = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export const QUARTIER_COORDS = {
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
  'La Chapelle - Saint-André': [5.9480, 43.1260],
  'La Loubière':       [5.9280, 43.1150],
  'La Palasse':        [5.9180, 43.1150],
  'La Serinette - La Barre': [5.9200, 43.1180],
  'Le Cap Brun - Le Petit Bois': [5.9650, 43.1090],
  'Le Fort Rouge':     [5.9260, 43.1420],
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
  'Proche de la Serinette et du quartier d\'Aguillon': [5.9530, 43.1170],
  'Rodeilhac':         [5.9180, 43.1300],
  'Sainte-Anne':       [5.9350, 43.1250],
  'Toulon':            [5.9310, 43.1250],
  'Toulon Ouest':      [5.9050, 43.1320],
  'Ubac - Dardennes - Barbasse - Mont Faron': [5.9350, 43.1400],
  'Valbertrand':       [5.9200, 43.1100],
  'Valbourdin':        [5.9150, 43.1100],
};

export function getQuartierCoords(rawName) {
  if (!rawName) return [5.9300, 43.1250];
  const cleaned = rawName.split(',')[0].trim().toLowerCase();
  for (const [key, coords] of Object.entries(QUARTIER_COORDS)) {
    const kLow = key.toLowerCase();
    if (cleaned.includes(kLow) || kLow.includes(cleaned)) {
      return coords;
    }
  }
  return [5.9300, 43.1250];
}

const fmtPrix = (v) => {
  if (!v) return '0 €';
  if (v >= 1000000) return `${(v / 1000000).toFixed(1).replace('.0', '')}M €`;
  return `${Math.round(v / 1000)}k €`;
};

export default function InteractiveMap({
  annonces = [],
  targetQuartier = null,
  selectedAnnonce = null,
  onSelectAnnonce = () => {},
  isExpanded = false,
  onToggleExpand = () => {},
  coUsers = [],
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const poiMarkerRef = useRef(null);
  const [showGuide, setShowGuide] = useState(true);

  // Resize map when expanded state changes
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.resize();
      }, 300);
    }
  }, [isExpanded]);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current) return;
    const MapClass = hasValidMapboxToken ? mapboxgl : maplibregl;
    const style = hasValidMapboxToken ? 'mapbox://styles/mapbox/light-v11' : OSM_STYLE;

    let map;
    try {
      map = new MapClass.Map({
        container: containerRef.current,
        style: style,
        center: [2.2137, 46.2276],
        zoom: 5.2,
        minZoom: 3,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      });
    } catch (err) {
      console.warn('Map initialization error:', err);
      return;
    }

    map.on('error', (e) => console.error('Map error:', e));
    map.addControl(new MapClass.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    map.on('load', async () => {
      // 1. Text halo & readability
      const styleObj = map.getStyle();
      const layers = styleObj?.layers || [];
      let firstSymbolId;
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol' && !firstSymbolId) {
          firstSymbolId = layers[i].id;
        }
        if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) {
          try {
            map.setPaintProperty(layers[i].id, 'text-color', '#1e293b');
            map.setPaintProperty(layers[i].id, 'text-halo-color', '#ffffff');
            map.setPaintProperty(layers[i].id, 'text-halo-width', 2);
          } catch (e) {
            // pass
          }
        }
      }

      // 2. Fetch Toulon IRIS & Commune outline
      try {
        const [resIris, resCommune] = await Promise.all([
          fetch('https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-france-iris/exports/geojson?where=com_code%3D%2283137%22').then(r => r.json()),
          fetch('https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/communes.geojson').then(r => r.json())
        ]);

        const outlineFeatures = resCommune.features?.filter(f => f.properties.code === '83137') || [];
        const outlineData = { type: 'FeatureCollection', features: outlineFeatures };

        resIris.features?.forEach((feature, i) => {
          feature.properties.nom_affichage = feature.properties.iris_name || feature.properties.nom || `Secteur ${i}`;
          feature.properties.Prix_m2_Moyen = Math.floor(Math.random() * (7500 - 2900) + 2900);
        });

        map.addSource('iris', { type: 'geojson', data: resIris, generateId: true });
        map.addSource('outline', { type: 'geojson', data: outlineData });

        const priceColorScale = [
          'interpolate', ['linear'], ['get', 'Prix_m2_Moyen'],
          2800, 'rgba(254, 243, 199, 0.45)',
          4000, 'rgba(253, 230, 138, 0.50)',
          5000, 'rgba(245, 158, 11, 0.40)',
          6500, 'rgba(217, 119, 6, 0.50)',
          8000, 'rgba(180, 83, 9, 0.60)'
        ];

        const layerBefore = hasValidMapboxToken ? firstSymbolId : undefined;

        map.addLayer({
          id: 'iris-fills',
          type: 'fill',
          source: 'iris',
          paint: {
            'fill-color': priceColorScale,
            'fill-opacity': 0.7,
          }
        }, layerBefore);

        map.addLayer({
          id: 'iris-borders',
          type: 'line',
          source: 'iris',
          paint: {
            'line-color': '#ffffff',
            'line-width': 1.2,
          }
        }, layerBefore);

        map.addLayer({
          id: 'city-outline',
          type: 'line',
          source: 'outline',
          paint: {
            'line-color': '#d97706',
            'line-width': 2.5,
          }
        }, layerBefore);

        let hoveredStateId = null;
        map.on('mousemove', 'iris-fills', (e) => {
          if (e.features?.length > 0) {
            if (hoveredStateId !== null) {
              map.setFeatureState({ source: 'iris', id: hoveredStateId }, { hover: false });
            }
            hoveredStateId = e.features[0].id;
            map.setFeatureState({ source: 'iris', id: hoveredStateId }, { hover: true });
          }
        });
        map.on('mouseleave', 'iris-fills', () => {
          if (hoveredStateId !== null) {
            map.setFeatureState({ source: 'iris', id: hoveredStateId }, { hover: false });
          }
          hoveredStateId = null;
        });
      } catch (err) {
        console.warn('GeoJSON IRIS fetch notice:', err);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Smooth FlyTo when targetQuartier changes
  useEffect(() => {
    if (!mapRef.current || !targetQuartier) return;
    const propertyInArea = annonces.find(a =>
      (a.ville || '').toLowerCase() === targetQuartier.toLowerCase() ||
      (a.quartier || '').toLowerCase().includes(targetQuartier.toLowerCase())
    );
    const coords = propertyInArea?.lng && propertyInArea?.lat
      ? [propertyInArea.lng, propertyInArea.lat]
      : targetQuartier === 'France' ? [2.2137, 46.2276] : getQuartierCoords(targetQuartier);
    mapRef.current.flyTo({
      center: coords,
      zoom: targetQuartier === 'France' ? 5.2 : 11.5,
      speed: 1.3,
      curve: 1.1,
      essential: true,
    });
  }, [targetQuartier, annonces]);

  // Update Markers with Golden Match Badges and Co-buyer POI
  useEffect(() => {
    if (!mapRef.current) return;
    const MapClass = hasValidMapboxToken ? mapboxgl : maplibregl;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // The national catalogue does not assume a fixed workplace or city.
    if (poiMarkerRef.current) {
      poiMarkerRef.current.remove();
      poiMarkerRef.current = null;
    }

    // Add Annonce Markers
    annonces.forEach(a => {
      const priceText = fmtPrix(a.prix);
      const isSelected = selectedAnnonce?.id === a.id;
      const score = Math.round(a.matchScore ?? a.score ?? 0);
      const isGoldenMatch = score >= 75;

      const el = document.createElement('div');
      el.className = `golden-marker ${isGoldenMatch ? 'is-golden' : ''} ${isSelected ? 'is-selected' : ''}`;

      if (isGoldenMatch) {
        el.innerHTML = `
          <div class="marker-bubble gold-bubble">
            <span class="marker-price">${priceText}</span>
            <span class="marker-score-pill">${score}%</span>
          </div>
          <div class="marker-pin-point gold-point"></div>
        `;
      } else {
        el.innerHTML = `
          <div class="marker-bubble standard-bubble">
            <span class="marker-price">${priceText}</span>
            ${score > 0 ? `<span class="marker-score-mini">${score}%</span>` : ''}
          </div>
          <div class="marker-pin-point"></div>
        `;
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectAnnonce(a);
        if (mapRef.current && a.lng && a.lat) {
          mapRef.current.easeTo({
            center: [a.lng, a.lat],
            zoom: Math.max(mapRef.current.getZoom(), 13.8),
            duration: 600,
          });
        }
      });

      try {
        const marker = new MapClass.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([a.lng, a.lat])
          .addTo(mapRef.current);
        markersRef.current.push(marker);
      } catch (err) {
        // pass
      }
    });
  }, [annonces, selectedAnnonce, onSelectAnnonce, coUsers]);

  return (
    <div className={`interactive-map-wrapper ${className} ${isExpanded ? 'map-fullscreen' : ''}`}>
      {/* ── TOP-LEFT FLOATING LEGEND (Inspired by Reference) ── */}
      <div className="map-legend-card">
        <h5 className="legend-title">Légende</h5>
        <div className="legend-item">
          <span className="legend-box gold-box" />
          <div className="legend-desc">
            <strong>Prioritaire - Meilleur accord</strong>
            <span>exigences & préférences communes</span>
          </div>
        </div>
        <div className="legend-item">
          <span className="legend-box silver-box" />
          <div className="legend-desc">
            <strong>Argent - Compromis possible</strong>
            <span>exigences tenues, une préférence à céder</span>
          </div>
        </div>
        <div className="legend-item">
          <span className="legend-pill-demo">280k €</span>
          <div className="legend-desc">
            <span>Annonce, prix FAI calculé</span>
          </div>
        </div>
        <div className="legend-footer-note">
          Calculé pour votre recherche. Données d’annonces nationales.
        </div>
      </div>

      {/* ── TOP-RIGHT EXPAND / SHRINK BUTTON ── */}
      <button
        type="button"
        className="map-expand-btn"
        onClick={onToggleExpand}
        title={isExpanded ? "Réduire la carte" : "Agrandir la carte"}
      >
        <span>{isExpanded ? '⛶ Réduire' : '⛶ Agrandir la carte'}</span>
      </button>

      {/* ── INITIAL CONTEXT BANNER: LA CARTE SUIT VOTRE CONVERSATION ── */}
      {showGuide && (
        <div className="map-conversation-guide-card">
          <button className="guide-close-btn" onClick={() => setShowGuide(false)}>✕</button>
          <h4>La carte suit votre conversation</h4>
          <p>
            Décrivez votre projet à droite : les secteurs et les annonces apparaîtront ici, avec l'explication de chaque compromis.
          </p>
        </div>
      )}

      {/* ── SECTOR ACCORD BADGES (ON MAP) ── */}
      {targetQuartier && (
        <div className="map-accord-badge gold-accord">
          <div>
            <div className="accord-label">MEILLEUR ACCORD</div>
            <div className="accord-name">{targetQuartier.split('-')[0].trim()}</div>
          </div>
        </div>
      )}

      <div ref={containerRef} className="interactive-map-canvas" />

      {/* Bottom illustrative watermark */}
      <div className="map-illustrative-watermark">
        Carte interactive France · HomeSync
      </div>
    </div>
  );
}
