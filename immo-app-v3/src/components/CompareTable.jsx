import { useEffect, useId, useRef, useState } from 'react';
import './CompareTable.css';

/* Comparatif d'annonces (3 au plus) : fenêtre par-dessus la page, une colonne par annonce.
   La meilleure valeur de chaque ligne est en aplat clair, avec une étoile (pas seulement la couleur).
   Échap, × ou un clic à l'extérieur ferment ; un clic sur une colonne ouvre l'annonce.
   Locations de vacances : lignes par nuit (voyageurs, chambres, lits, note, séjour minimum) ;
   achat et location mélangés : « — » là où la donnée n'existe pas, unité précisée sur le prix. */

const TEXT = {
  en: {
    title: 'Compare listings', sub: n => (n === 1 ? '1 listing in the comparison (3 max).' : `${n} listings side by side (3 max).`), legend: 'Best value in the row', best: '(best value)',
    close: 'Close the comparison', empty: 'No listing to compare yet. Use “Compare” on a listing.', addMore: 'Add at least one more listing to compare.',
    open: '(open the listing)', remove: 'Remove', removeOf: t => `Remove: ${t}`, criterion: 'Criterion', missing: 'not specified',
    price: 'Price', area: 'Area', ppm2: 'Price per\u00a0m²', calculated: 'calculated', rooms: 'Rooms', dpe: 'DPE', place: 'District\u00a0· city', matching: 'Matching', home: 'Home',
    perNight: 'Price per night', night: 'night', purchase: 'purchase price', guests: 'Guests', bedrooms: 'Bedrooms', studio: 'Studio', beds: 'Beds', rating: 'Rating',
    reviews: n => `${n} review${n === '1' ? '' : 's'}`, minStay: 'Minimum stay', nights: n => `${n} night${n === 1 ? '' : 's'}`,
    credit: { lead: 'Rental data: ', licence: ', licensed under ', when: d => ` — data collected in ${d}.` }, newTabShort: '(new tab)',
  },
  fr: {
    title: 'Comparer les annonces', sub: n => (n === 1 ? '1 annonce dans le comparatif (3 au plus).' : `${n} annonces côte à côte (3 au plus).`), legend: 'Meilleure valeur de la ligne', best: '(meilleure valeur)',
    close: 'Fermer le comparatif', empty: 'Aucune annonce à comparer pour l’instant. Utilisez « Comparer » sur une annonce.', addMore: 'Ajoutez au moins une autre annonce pour comparer.',
    open: '(ouvrir l’annonce)', remove: 'Retirer', removeOf: t => `Retirer : ${t}`, criterion: 'Critère', missing: 'non communiqué',
    price: 'Prix', area: 'Surface', ppm2: 'Prix au\u00a0m²', calculated: 'calculé', rooms: 'Pièces', dpe: 'DPE', place: 'Quartier\u00a0· ville', matching: 'Matching', home: 'Logement',
    perNight: 'Prix par nuit', night: 'nuit', purchase: 'prix d’achat', guests: 'Voyageurs', bedrooms: 'Chambres', studio: 'Studio', beds: 'Lits', rating: 'Note',
    reviews: n => `${n} avis`, minStay: 'Séjour minimum', nights: n => `${n} nuit${n > 1 ? 's' : ''}`,
    credit: { lead: 'Données de locations : ', licence: ', licence ', when: d => ` — données collectées en ${d}.` }, newTabShort: '(nouvel onglet)',
  },
};
const LOCALE = { en: 'en-US', fr: 'fr-FR' };
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const pos = v => (isNum(v) && v > 0 ? v : null);
// Espace fine (U+202F) presque invisible avec Outfit : espace insécable normale à la place.
const num = (v, lang) => v.toLocaleString(LOCALE[lang], { maximumFractionDigits: 2 }).replace(/\u202f/g, '\u00a0');
const euros = (v, lang) => `${num(Math.round(v), lang)}\u00a0€`;
// Montant exact : entier sans décimales, sinon deux décimales (nuitée à 130,55 €).
const amount = (v, lang) => `${Number.isInteger(v) ? num(v, lang) : v.toLocaleString(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f/g, '\u00a0')}\u00a0€`;
const monthYear = (iso, lang) => { const m = /^(\d{4})-(\d{2})/.exec(iso || ''); return m ? new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(+m[1], +m[2] - 1, 15)) : null; };
const rent = a => a?.unite_prix === 'nuit';
const dpeLetter = v => (typeof v === 'string' && /^[A-G]$/i.test(v.trim()) ? v.trim().toUpperCase() : null);
// Accepte l'annonce complète de l'API comme l'objet compact du comparateur (photo, score).
const photoOf = a => (Array.isArray(a.photos) ? a.photos.find(p => typeof p === 'string' && p) : null) || (typeof a.photo === 'string' && a.photo) || null;
const scoreOf = a => (isNum(a.match?.score) ? a.match.score : isNum(a.score) ? a.score : null);
// Meilleure valeur d'une ligne : seulement si au moins deux valeurs existent et qu'elles diffèrent.
const bestOf = (values, how) => {
  const xs = values.filter(v => v != null);
  if (!how || xs.length < 2) return null;
  const b = xs.reduce((m, v) => ((how === 'min' ? v < m : v > m) ? v : m));
  return xs.every(v => v === b) ? null : b;
};

const svg = (body, size = 18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>;
const I = {
  close: svg(<path d="M6 6l12 12M18 6 6 18" />, 20),
  remove: svg(<path d="M7 7l10 10M17 7 7 17" />, 14),
  star: <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" /></svg>,
  house: svg(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v12h14V9" /><path d="M10 21v-6h4v6" /></>, 30),
};

function Photo({ src }) {
  const [broken, setBroken] = useState(false);
  return <span className="ct-photo">{src && !broken ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : I.house}</span>;
}

export default function CompareTable({ listings = [], lang = 'en', onRemove, onClose, onOpen }) {
  const lg = TEXT[lang] ? lang : 'en';
  const tx = TEXT[lg];
  const uid = useId();
  const box = useRef(null);
  const down = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const [hover, setHover] = useState(-1);

  // Focus dans la fenêtre à l'ouverture, rendu à l'élément d'origine à la fermeture.
  // Échap est capté en premier (window, phase de capture) : il ne ferme que le comparatif.
  useEffect(() => {
    const opener = document.activeElement;
    const node = box.current;
    node?.focus({ preventScroll: true });
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current?.(); } };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const now = document.activeElement;
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected && (!now || now === document.body || node?.contains(now))) opener.focus({ preventScroll: true });
    };
  }, []);
  // Tabulation gardée dans la fenêtre.
  const trap = e => {
    if (e.key !== 'Tab') return;
    const nodes = [...box.current.querySelectorAll('button,a[href],[tabindex="0"]')].filter(n => !n.disabled && n.offsetParent !== null);
    if (!nodes.length) { e.preventDefault(); return; }
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const items = Array.isArray(listings) ? listings.filter(Boolean) : [];
  const n = items.length;
  const name = a => a.titre || a.type || tx.home;
  // Lignes selon les annonces comparées : achat, location, ou les deux (« — » là où la donnée manque).
  const kinds = { buy: items.some(a => !rent(a)), rent: items.some(rent) };
  const mixed = kinds.buy && kinds.rent;
  const credited = items.filter(a => rent(a) && (!a.source || /inside\s*airbnb/i.test(a.source)));
  const collected = monthYear(credited.map(a => a.date_donnees).filter(Boolean).sort()[0], lg);
  const rows = [
    { key: 'prix', kind: 'both', label: kinds.rent && !kinds.buy ? tx.perNight : tx.price, get: a => pos(a.prix), best: mixed ? null : 'min',
      show: (v, a) => (!mixed ? amount(v, lg) : rent(a) ? <>{amount(v, lg)}<span className="ct-unit"> / {tx.night}</span></> : <>{euros(v, lg)}<small>{tx.purchase}</small></>) },
    { key: 'surface', kind: 'buy', label: tx.area, get: a => pos(a.surface), show: v => `${num(v, lg)} m²`, best: 'max' },
    { key: 'm2', kind: 'buy', label: tx.ppm2, note: tx.calculated, get: a => (pos(a.prix) && pos(a.surface) ? Math.round(a.prix / a.surface) : null), show: v => `${euros(v, lg)}/m²`, best: 'min' },
    { key: 'pieces', kind: 'buy', label: tx.rooms, get: a => pos(a.nb_pieces), show: v => num(v, lg), best: 'max' },
    { key: 'dpe', kind: 'buy', label: tx.dpe, get: a => dpeLetter(a.dpe), show: v => <span className={`ct-dpe ct-dpe-${v}`}>{v}</span>, best: 'min' },
    { key: 'voyageurs', kind: 'rent', label: tx.guests, get: a => pos(a.voyageurs), show: v => num(v, lg), best: 'max' },
    { key: 'chambres', kind: 'rent', label: tx.bedrooms, get: a => (isNum(a.chambres) && a.chambres >= 0 ? a.chambres : null), show: v => (v === 0 ? tx.studio : num(v, lg)), best: 'max' },
    { key: 'lits', kind: 'rent', label: tx.beds, get: a => pos(a.lits), show: v => num(v, lg), best: 'max' },
    { key: 'note', kind: 'rent', label: tx.rating, get: a => (isNum(a.note) ? a.note : null), show: (v, a) => <><span aria-hidden="true">★ </span>{num(v, lg)}{isNum(a.nb_avis) && <small>{tx.reviews(num(a.nb_avis, lg))}</small>}</>, best: 'max' },
    { key: 'nuits', kind: 'rent', label: tx.minStay, get: a => pos(a.min_nuits), show: v => tx.nights(v), best: 'min' },
    { key: 'lieu', kind: 'both', label: tx.place, get: a => (a.quartier || a.ville ? a : null), show: a => <>{a.quartier && <span className="ct-strong">{a.quartier}</span>}{a.ville && <small>{[a.ville, a.code_postal].filter(Boolean).join(' ')}</small>}</>, best: null },
    { key: 'match', kind: 'both', label: tx.matching, get: a => scoreOf(a), show: v => `${Math.round(v)}/100`, best: 'max' },
  ].filter(r => r.kind === 'both' || kinds[r.kind]);
  const remove = a => { onRemove?.(a.id_source); box.current?.focus({ preventScroll: true }); };
  const col = i => (hover === i ? ' ct-hover' : '');

  return (
    <div className="ct-backdrop" onMouseDown={e => { down.current = e.target === e.currentTarget; }} onClick={e => { if (down.current && e.target === e.currentTarget) close.current?.(); }}>
      <section className={`ct${n > 0 && n < 3 ? ` ct-n${n}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={`${uid}t`} ref={box} tabIndex={-1} onKeyDown={trap}>
        <button type="button" className="ct-close" aria-label={tx.close} onClick={() => close.current?.()}>{I.close}</button>
        <div className="ct-head">
          <h2 className="ct-title" id={`${uid}t`}>{tx.title}</h2>
          {n > 0 && <p className="ct-sub">{tx.sub(n)}{n > 1 && <span className="ct-legend"><span className="ct-star">{I.star}</span>{tx.legend}</span>}</p>}
          {n === 1 && <p className="ct-hint">{tx.addMore}</p>}
        </div>
        {n === 0 ? <p className="ct-empty">{tx.empty}</p> : <div className="ct-scroll">
          <table className="ct-table" onMouseLeave={() => setHover(-1)}>
            <caption className="ct-sr">{tx.title}</caption>
            <thead><tr>
              <th scope="col" className="ct-label"><span className="ct-sr">{tx.criterion}</span></th>
              {items.map((a, i) => <th scope="col" key={a.id_source ?? i} className={`ct-col${col(i)}`} onMouseEnter={() => setHover(i)}>
                <button type="button" className="ct-open" onClick={() => onOpen?.(a)}><Photo src={photoOf(a)} /><span className="ct-name">{name(a)}</span><span className="ct-sr">{tx.open}</span></button>
                <button type="button" className="ct-remove" aria-label={tx.removeOf(name(a))} onClick={() => remove(a)}>{I.remove}{tx.remove}</button>
              </th>)}
            </tr></thead>
            <tbody>{rows.map(r => {
              const values = items.map(r.get);
              const best = bestOf(values, r.best);
              return <tr key={r.key}>
                <th scope="row" className="ct-label">{r.label}{r.note && <small>{r.note}</small>}</th>
                {items.map((a, i) => {
                  const v = values[i];
                  const top = best != null && v === best;
                  return <td key={a.id_source ?? i} className={`${top ? 'ct-best' : ''}${col(i)}`} onMouseEnter={() => setHover(i)} onClick={() => onOpen?.(a)}>
                    {v == null ? <><span aria-hidden="true">—</span><span className="ct-sr">{tx.missing}</span></> : r.show(v, a)}
                    {top && <><span className="ct-star">{I.star}</span><span className="ct-sr">{tx.best}</span></>}
                  </td>;
                })}
              </tr>;
            })}</tbody>
          </table>
        </div>}
        {credited.length > 0 && <p className="ct-credit">{tx.credit.lead}<a href="https://insideairbnb.com/" target="_blank" rel="noreferrer">Inside Airbnb (insideairbnb.com)<span className="ct-sr"> {tx.newTabShort}</span></a>{tx.credit.licence}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0<span className="ct-sr"> {tx.newTabShort}</span></a>{collected ? tx.credit.when(collected) : '.'}</p>}
      </section>
    </div>
  );
}
