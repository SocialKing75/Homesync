import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getLang } from '../i18n';
import { FICHES, PARIS, VILLES } from './introData';
import './IntroSplash.css';

/* Intro d'arrivée (≈ 6 s) sur la vraie carte claire de France : des pastilles
   donnent le nombre d'annonces par ville, une loupe cherche, une phrase est
   « dictée », la carte plonge sur Paris et ses annonces, des fiches défilent
   (like / dislike), puis l'application apparaît. Jouée une fois par session,
   jamais si l'utilisateur demande moins d'animations ; « Passer » la coupe. */
maplibregl.setWorkerUrl(workerUrl);

const SEEN = 'homesync_intro_seen';
const TEXT = {
  en: { phrase: 'I’m looking for an apartment in Paris', skip: 'Skip', like: 'Like', dislike: 'Dislike', rooms: 'rooms', label: 'HomeSync intro', listings: n => `${n} listings` },
  fr: { phrase: 'Je cherche un appartement à Paris', skip: 'Passer', like: 'J’aime', dislike: 'Je passe', rooms: 'pièces', label: 'Intro HomeSync', listings: n => `${n} annonces` },
};
const PARIS_CENTER = [2.345, 48.861];
// La loupe survole quelques villes avant de s'arrêter sur Paris.
const LENS_PATH = ['Bordeaux', 'Lyon', 'Toulon', 'Rennes', 'Paris'];
// Étapes (ms, depuis le chargement de la carte).
const STEPS = [['zoom', 2200], ['listings', 3000], ['cards', 3600], ['swipe1', 4150], ['swipe2', 4700], ['out', 5400], ['done', 5900]];
const compact = (n, locale) => (n >= 1e6 ? `${(n / 1e6).toLocaleString(locale, { maximumFractionDigits: 1 })} M€` : `${Math.round(n / 1e3)} k€`);

const shouldPlay = () => {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return sessionStorage.getItem(SEEN) !== '1';
  } catch { return false; }
};

export default function IntroSplash() {
  const [play, setPlay] = useState(shouldPlay);
  const [phase, setPhase] = useState('loading');
  const [typed, setTyped] = useState(0);
  const [lens, setLens] = useState(null);
  // L'animation ne démarre qu'une fois l'affiche passée ET la carte chargée.
  const [poster, setPoster] = useState(true);
  const gate = useRef({ loaded: false, poster: false, started: false, begin: null, imgLoaded: false });
  const posterTimer = useRef(null);
  const box = useRef(null);
  const lang = getLang();
  const tx = TEXT[lang];
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const posterDone = () => {
    if (gate.current.poster) return;
    gate.current.poster = true;
    setPoster(false);
    if (gate.current.loaded) gate.current.begin?.();
  };
  useEffect(() => () => clearTimeout(posterTimer.current), []);

  const finish = () => {
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* Navigation privée : l'intro peut revenir. */ }
    setPlay(false);
  };

  useEffect(() => {
    if (!play) return undefined;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const m = new maplibregl.Map({
      // Carte claire, ou sombre si l'appareil est réglé en mode sombre.
      container: box.current, style: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/positron', interactive: false,
      bounds: [[-5.2, 41.3], [9.7, 51.2]], fitBoundsOptions: { padding: { top: 70, bottom: 150, left: 30, right: 30 } }, attributionControl: { compact: true },
    });
    // Carte injoignable : on n'impose pas d'attente, l'application s'affiche.
    let loaded = false;
    later(() => { if (!gate.current.imgLoaded) posterDone(); }, 4000);
    later(() => { if (!loaded) finish(); }, 8500);
    m.on('error', () => { if (!loaded) finish(); });
    m.once('load', () => {
      loaded = true;
      const villes = { type: 'FeatureCollection', features: [] };
      m.addSource('villes', { type: 'geojson', data: villes });
      m.addLayer({ id: 'villes', type: 'circle', source: 'villes', paint: { 'circle-color': '#2D4263', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3, 'circle-radius': ['interpolate', ['linear'], ['get', 'n'], 20, 17, 300, 27], 'circle-opacity-transition': { duration: 300 }, 'circle-stroke-opacity-transition': { duration: 300 } } });
      m.addLayer({ id: 'villes-n', type: 'symbol', source: 'villes', layout: { 'text-field': ['to-string', ['get', 'n']], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff', 'text-opacity-transition': { duration: 300 } } });
      m.addSource('paris', { type: 'geojson', data: { type: 'FeatureCollection', features: PARIS.map(([lon, lat, prix]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { prix: compact(prix, locale) } })) } });
      m.addLayer({ id: 'paris', type: 'circle', source: 'paris', paint: { 'circle-color': '#B87333', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3, 'circle-radius': 9, 'circle-opacity': 0, 'circle-stroke-opacity': 0, 'circle-opacity-transition': { duration: 400 }, 'circle-stroke-opacity-transition': { duration: 400 } } });
      m.addLayer({ id: 'paris-prix', type: 'symbol', source: 'paris', layout: { 'text-field': ['get', 'prix'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-allow-overlap': false }, paint: { 'text-color': '#2D4263', 'text-halo-color': '#ffffff', 'text-halo-width': 2, 'text-opacity': 0, 'text-opacity-transition': { duration: 400 } } });

      gate.current.begin = () => {
        if (gate.current.started) return;
        gate.current.started = true;
        setPhase('search');
        // Les pastilles apparaissent une à une, des plus grandes villes aux autres.
        VILLES.forEach(([ville, n, lat, lon], i) => later(() => {
          villes.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { ville, n } });
          m.getSource('villes')?.setData(villes);
        }, 120 + i * 45));
        const at = name => { const v = VILLES.find(c => c[0] === name); const p = m.project([v[3], v[2]]); return { x: p.x, y: p.y }; };
        LENS_PATH.forEach((ville, i) => later(() => setLens(at(ville)), 250 + i * 420));
        later(() => {
          const id = setInterval(() => setTyped(n => (n >= tx.phrase.length ? (clearInterval(id), n) : n + 1)), 32);
          timers.push(id);
        }, 300);
        STEPS.forEach(([p, ms]) => later(() => {
          if (p === 'done') { finish(); return; }
          setPhase(p);
          if (p === 'zoom') {
            for (const [layer, props] of [['villes', ['circle-opacity', 'circle-stroke-opacity']], ['villes-n', ['text-opacity']]]) props.forEach(k => m.setPaintProperty(layer, k, 0));
            m.flyTo({ center: PARIS_CENTER, zoom: 11.4, duration: 1100, essential: true, curve: 1.3 });
          }
          if (p === 'listings') {
            m.setPaintProperty('paris', 'circle-opacity', 1); m.setPaintProperty('paris', 'circle-stroke-opacity', 1); m.setPaintProperty('paris-prix', 'text-opacity', 1);
          }
        }, ms));
      };
      gate.current.loaded = true;
      if (gate.current.poster) gate.current.begin();
    });
    return () => { timers.forEach(clearTimeout); m.remove(); };
    // Une seule lecture au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  if (!play) return null;
  const paris = VILLES.find(v => v[0] === 'Paris');
  return (
    <div className={`intro intro-${phase}`} role="dialog" aria-label={tx.label}>
      <div ref={box} className="intro-map" />
      <div className="intro-brand">Home<span>Sync</span></div>
      {poster && <div className="intro-poster"><img src="/devday-paris.gif" alt="OpenAI DevDay Community Hackathon Paris" onLoad={() => { gate.current.imgLoaded = true; posterTimer.current = setTimeout(posterDone, 3900); }} onError={posterDone} /></div>}
      <button className="intro-skip" onClick={finish}>{tx.skip} →</button>
      {lens && <div className="intro-lens" aria-hidden="true" style={{ left: lens.x, top: lens.y }}><span /></div>}
      <div className="intro-pin" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" /></svg>Paris · {tx.listings(paris[1])}</div>
      <div className="intro-deck" aria-hidden="true">
        {FICHES.map((c, i) => (
          <article key={c.quartier} className={`intro-card intro-card-${i}`}>
            <div className="intro-photo" />
            <strong>{c.prix.toLocaleString(locale)} €</strong>
            <span>{c.quartier} · {c.pieces} {tx.rooms} · {c.surface} m²</span>
            <em className="intro-tag intro-like">♥ {tx.like}</em>
            <em className="intro-tag intro-dislike">✕ {tx.dislike}</em>
          </article>
        ))}
      </div>
      <div className="intro-voice" aria-live="polite">
        <span className="intro-mic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v5" /></svg></span>
        <span className="intro-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span className="intro-phrase">« {tx.phrase.slice(0, typed)}<b className="intro-caret" /> »</span>
      </div>
    </div>
  );
}
