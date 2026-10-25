import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { formatPrice } from '../i18n';
// Worker servi depuis la même origine : compatible avec la CSP existante sans blob:.
maplibregl.setWorkerUrl(workerUrl);

// Fonds proposés : plan clair et sombre (OpenFreeMap), satellite (Esri World Imagery, sans clé).
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  satellite: {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { sat: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] } },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
  },
};
const MAP_KEY = 'homesync_map';
// Fond de carte : un choix fait au clic reste prioritaire ; sinon il suit l'appareil (sombre ou clair).
// Les versions précédentes enregistraient « light » sans clic : seul un ancien « dark » ou « satellite » compte comme un choix.
const MAP_SET = 'homesync_map_set';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const deviceMode = () => (window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light');
const chosenMode = () => { try { const v = localStorage.getItem(MAP_KEY); return STYLES[v] && (localStorage.getItem(MAP_SET) === '1' || v !== 'light') ? v : null; } catch { return null; } };
const savedMode = () => chosenMode() || deviceMode();
const pointColor = id => ['case', ['==', ['get', 'id'], id || ''], '#2D4263', '#B87333'];

// Marges de la carte (px) : la plus grande valeur entre le prop `padding` (panneau d'annonce à gauche, bandeau en bas,
// éventuellement droite) et les variables CSS --map-pad-left/right/bottom (conversation posée sur la carte, ordinateur seulement).
// Elles sont réduites si la carte est trop étroite pour les contenir.
const edgesOf = (el, padding) => {
  const css = el ? getComputedStyle(el) : null;
  const get = side => Math.max(padding?.[side] || 0, parseFloat(css?.getPropertyValue(`--map-pad-${side}`)) || 0);
  let left = get('left'), right = get('right'), bottom = get('bottom');
  const w = el?.clientWidth || 0, h = el?.clientHeight || 0;
  if (w && left + right > w - 160) { const k = Math.max(0, w - 160) / (left + right); left *= k; right *= k; }
  if (h && bottom > h - 160) bottom = Math.max(0, h - 160);
  return { left, right, bottom };
};
const offsetOf = e => [(e.left - e.right) / 2, -e.bottom / 2];

export default function ConnectedMap({ t, annonces, selected, onSelect, focus, padding = { left: 0, right: 0, bottom: 0 } }) {
  const pad = useRef(padding);
  pad.current = padding;
  const container = useRef(null);
  const map = useRef(null);
  const select = useRef(onSelect);
  const text = useRef(t);
  const data = useRef({ type: 'FeatureCollection', features: [] });
  const selectedId = useRef('');
  const [mode, setMode] = useState(savedMode);
  const firstMode = useRef(mode);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { select.current = onSelect; text.current = t; }, [onSelect, t]);
  useEffect(() => {
    const e0 = edgesOf(container.current, pad.current);
    const m = new maplibregl.Map({ container: container.current, style: STYLES[firstMode.current], bounds: [[-5.2, 41.3], [9.7, 51.2]], fitBoundsOptions: { padding: { top: 25, right: 25 + e0.right, bottom: 25 + e0.bottom, left: 25 + e0.left } }, attributionControl: true });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    m.on('style.load', () => {
      m.addSource('homes', { type: 'geojson', data: data.current, cluster: true, clusterRadius: 45 });
      m.addLayer({ id: 'clusters', type: 'circle', source: 'homes', filter: ['has', 'point_count'], paint: { 'circle-color': '#2D4263', 'circle-radius': 23, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
      m.addLayer({ id: 'counts', type: 'symbol', source: 'homes', filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-font': ['Noto Sans Regular'], 'text-size': 14 }, paint: { 'text-color': '#ffffff' } });
      m.addLayer({ id: 'points', type: 'circle', source: 'homes', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 10, 'circle-color': pointColor(selectedId.current), 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
      m.addLayer({ id: 'prices', type: 'symbol', source: 'homes', filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'price'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.7] }, paint: { 'text-color': '#2D4263', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      setReady(true);
    });
    m.on('click', 'points', e => select.current(e.features[0].properties.id));
    m.on('click', 'prices', e => select.current(e.features[0].properties.id));
    m.on('click', 'clusters', async e => {
      const f = e.features[0];
      try { const zoom = await m.getSource('homes').getClusterExpansionZoom(f.properties.cluster_id); m.easeTo({ center: f.geometry.coordinates, zoom, offset: offsetOf(edgesOf(container.current, pad.current)), duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 }); } catch { setError(text.current.mapZoom); }
    });
    for (const id of ['points', 'prices', 'clusters']) {
      m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', id, () => { m.getCanvas().style.cursor = ''; });
    }
    m.on('error', () => setError(text.current.mapError));
    m.on('render', () => {
      if (m.getLayer('points')) {
        container.current.dataset.renderedCount = String(m.queryRenderedFeatures({ layers: ['points', 'clusters'] }).length);
      }
    });
    const observer = new ResizeObserver(() => m.resize()); observer.observe(container.current);
    return () => { observer.disconnect(); m.remove(); map.current = null; };
  }, []);
  // Sans choix explicite, le fond suit l'appareil quand il passe du clair au sombre (et inversement).
  const chosen = useRef(!!chosenMode());
  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq) return undefined;
    const follow = () => { if (!chosen.current && !chosenMode()) setMode(mq.matches ? 'dark' : 'light'); };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, []);
  const pickMode = k => {
    chosen.current = true; setMode(k);
    try { localStorage.setItem(MAP_KEY, k); localStorage.setItem(MAP_SET, '1'); } catch { /* Navigation privée : le choix vaut pour l'onglet. */ }
  };
  useEffect(() => {
    if (!map.current || mode === firstMode.current) return;
    firstMode.current = mode;
    setError('');
    map.current.setStyle(STYLES[mode], { diff: false });
  }, [mode]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const located = annonces.filter(a => typeof a.lat === 'number' && typeof a.lon === 'number' && Number.isFinite(a.lat) && Number.isFinite(a.lon) && Math.abs(a.lat) <= 90 && Math.abs(a.lon) <= 180);
    data.current = { type: 'FeatureCollection', features: located.map(a => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.lon, a.lat] }, properties: { id: a.id_source, price: formatPrice(t, a.prix) + (a.unite_prix === 'nuit' ? t.perNightShort : '') } })) };
    map.current.getSource('homes')?.setData(data.current);
    container.current.dataset.locatedCount = String(located.length);
    if (located.length) {
      const bounds = new maplibregl.LngLatBounds(); located.forEach(a => bounds.extend([a.lon, a.lat]));
      const e = edgesOf(container.current, pad.current);
      map.current.fitBounds(bounds, { padding: { top: 65, right: 65 + e.right, bottom: 65 + e.bottom, left: 65 + e.left }, maxZoom: 13, duration: 0 });
    }
  }, [annonces, ready, t]);
  useEffect(() => {
    if (!ready || !map.current) return;
    selectedId.current = selected?.id_source || '';
    if (map.current.getLayer('points')) map.current.setPaintProperty('points', 'circle-color', pointColor(selectedId.current));
    if (typeof selected?.lat === 'number' && typeof selected?.lon === 'number') map.current.easeTo({ center: [selected.lon, selected.lat], offset: offsetOf(edgesOf(container.current, pad.current)), duration: 0 });
  }, [selected, ready]);
  // Ville(s) comprise(s) par l'assistant : la carte s'y rend, sans attendre les résultats.
  useEffect(() => {
    if (!ready || !map.current || !focus?.points?.length) return;
    const e = edgesOf(container.current, pad.current);
    const padding = { top: 80, right: 80 + e.right, bottom: 80 + e.bottom, left: 80 + e.left };
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1400;
    if (focus.points.length === 1) map.current.flyTo({ center: focus.points[0], zoom: 11.5, padding, duration, essential: true });
    else { const b = new maplibregl.LngLatBounds(); focus.points.forEach(p => b.extend(p)); map.current.fitBounds(b, { padding, maxZoom: 11, duration }); }
  }, [focus, ready]);
  return <div className="hs-map-wrap" data-mode={mode}><div ref={container} className="hs-map" aria-label={t.mapLabel} />{error && <p className="hs-map-error" role="status">{error}</p>}<p className="hs-map-caption">{t.mapCaption}</p><div className="hs-map-styles" role="group" aria-label={t.mapStyle}>{['light', 'dark', 'satellite'].map(k => <button key={k} type="button" aria-pressed={mode === k} onClick={() => pickMode(k)}>{t.mapModes[k]}</button>)}</div></div>;
}
