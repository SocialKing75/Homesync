import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
import 'maplibre-gl/dist/maplibre-gl.css';
// Worker servi depuis la même origine : compatible avec la CSP existante sans blob:.
maplibregl.setWorkerUrl(workerUrl);

export default function ConnectedMap({ annonces, selected, onSelect }) {
  const container = useRef(null);
  const map = useRef(null);
  const select = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    const m = new maplibregl.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty', bounds: [[-5.2, 41.3], [9.7, 51.2]], fitBoundsOptions: { padding: 25 }, attributionControl: true });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    m.once('style.load', () => {
      m.addSource('homes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 45 });
      m.addLayer({ id: 'clusters', type: 'circle', source: 'homes', filter: ['has', 'point_count'], paint: { 'circle-color': '#2D4263', 'circle-radius': 23 } });
      m.addLayer({ id: 'counts', type: 'symbol', source: 'homes', filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-font': ['Noto Sans Regular'], 'text-size': 14 }, paint: { 'text-color': '#ffffff' } });
      m.addLayer({ id: 'points', type: 'circle', source: 'homes', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 10, 'circle-color': '#B87333', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
      m.addLayer({ id: 'prices', type: 'symbol', source: 'homes', filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'price'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.7] }, paint: { 'text-color': '#2D4263', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      m.on('click', 'points', e => select.current(e.features[0].properties.id));
      m.on('click', 'prices', e => select.current(e.features[0].properties.id));
      m.on('click', 'clusters', async e => {
        const f = e.features[0];
        try { const zoom = await m.getSource('homes').getClusterExpansionZoom(f.properties.cluster_id); m.easeTo({ center: f.geometry.coordinates, zoom, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 }); } catch { setError('Zoom du groupe indisponible.'); }
      });
      for (const id of ['points', 'prices', 'clusters']) {
        m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', id, () => { m.getCanvas().style.cursor = ''; });
      }
      setReady(true);
    });
    m.on('error', () => setError('Une ressource cartographique est indisponible. La liste reste accessible.'));
    m.on('render', () => {
      if (m.getLayer('points')) {
        container.current.dataset.renderedCount = String(m.queryRenderedFeatures({ layers: ['points', 'clusters'] }).length);
      }
    });
    const observer = new ResizeObserver(() => m.resize()); observer.observe(container.current);
    return () => { observer.disconnect(); m.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const located = annonces.filter(a => typeof a.lat === 'number' && typeof a.lon === 'number' && Number.isFinite(a.lat) && Number.isFinite(a.lon) && Math.abs(a.lat) <= 90 && Math.abs(a.lon) <= 180);
    map.current.getSource('homes').setData({ type: 'FeatureCollection', features: located.map(a => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.lon, a.lat] }, properties: { id: a.id_source, price: a.prix == null ? 'Prix à confirmer' : `${a.prix.toLocaleString('fr-FR')} €` } })) });
    container.current.dataset.locatedCount = String(located.length);
    if (located.length) {
      const bounds = new maplibregl.LngLatBounds(); located.forEach(a => bounds.extend([a.lon, a.lat]));
      map.current.fitBounds(bounds, { padding: 65, maxZoom: 13, duration: 0 });
    }
  }, [annonces, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setPaintProperty('points', 'circle-color', ['case', ['==', ['get', 'id'], selected?.id_source || ''], '#2D4263', '#B87333']);
    if (typeof selected?.lat === 'number' && typeof selected?.lon === 'number') map.current.easeTo({ center: [selected.lon, selected.lat], duration: 0 });
  }, [selected, ready]);
  return <div className="hs-map-wrap"><div ref={container} className="hs-map" aria-label="Carte des annonces retournées par Trouvelenom" />{error && <p className="hs-map-error" role="status">{error}</p>}<p className="hs-map-caption">Seules les annonces géolocalisées sont représentées. Le catalogue ne couvre pas nécessairement toute la France.</p></div>;
}
