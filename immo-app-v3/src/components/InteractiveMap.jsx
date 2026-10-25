import { useRef, useEffect } from 'react';
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

const hasCoordinates = (lng, lat) => {
  const longitude = Number(lng);
  const latitude = Number(lat);
  return Number.isFinite(longitude) && Number.isFinite(latitude)
    && longitude >= -6 && longitude <= 10 && latitude >= 41 && latitude <= 52;
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
    const hasAreaCoordinates = hasCoordinates(propertyInArea?.lng, propertyInArea?.lat);
    const coords = hasAreaCoordinates ? [Number(propertyInArea.lng), Number(propertyInArea.lat)] : [2.2137, 46.2276];
    mapRef.current.flyTo({
      center: coords,
      zoom: targetQuartier === 'France' || !hasAreaCoordinates ? 5.2 : 11.5,
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
    annonces.filter(a => hasCoordinates(a.lng, a.lat)).forEach(a => {
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
        if (mapRef.current && hasCoordinates(a.lng, a.lat)) {
          mapRef.current.easeTo({
            center: [Number(a.lng), Number(a.lat)],
            zoom: Math.max(mapRef.current.getZoom(), 13.8),
            duration: 600,
          });
        }
      });

      try {
        const marker = new MapClass.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([Number(a.lng), Number(a.lat)])
          .addTo(mapRef.current);
        markersRef.current.push(marker);
      } catch (err) {
        // pass
      }
    });
  }, [annonces, selectedAnnonce, onSelectAnnonce, coUsers]);

  return (
    <div className={`interactive-map-wrapper ${className} ${isExpanded ? 'map-fullscreen' : ''}`}>
      {/* ── TOP-RIGHT EXPAND / SHRINK BUTTON ── */}
      <button
        type="button"
        className="map-expand-btn"
        onClick={onToggleExpand}
        title={isExpanded ? "Réduire la carte" : "Agrandir la carte"}
      >
        <span>{isExpanded ? '⛶ Réduire' : '⛶ Agrandir la carte'}</span>
      </button>

      <div ref={containerRef} className="interactive-map-canvas" />

      {/* Bottom illustrative watermark */}
      <div className="map-illustrative-watermark">
        Carte interactive France · HomeSync
      </div>
    </div>
  );
}
