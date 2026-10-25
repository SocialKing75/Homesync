import { useEffect, useId, useRef, useState } from 'react';
import './ListingPanel.css';

/* Panneau d'annonce ouvert depuis la carte, à gauche (façon Google Maps) : photos, titre,
   localisation, prix, caractéristiques, matching, puis les actions (favori, comparer,
   question, visite). Sur mobile : feuille plein écran. Aucun chiffre inventé : ce qui
   manque est affiché « à confirmer » ou « non communiqué ».
   Location de vacances (unite_prix « nuit ») : prix par nuit, voyageurs, chambres, lits, note,
   « Voir les disponibilités » et mention obligatoire Inside Airbnb (CC BY 4.0). */

const TEXT = {
  en: {
    close: 'Close the listing', photos: n => `Listing photos (${n})`, prev: 'Previous photo', next: 'Next photo',
    photoOf: (i, n) => `Photo ${i} of ${n}`, noPhoto: 'No photo for this listing',
    home: 'Home', placeTbc: 'Location to be confirmed',
    price: 'Price', charges: 'Charges', notSpecified: 'Not specified', total: 'Total incl. VAT', chargesExcluded: 'charges not included', tbc: 'To be confirmed',
    details: 'Characteristics', area: 'Area', rooms: 'Rooms', ppm2: 'Price per m²', calculated: 'calculated', calcHint: 'Calculated by HomeSync: price ÷ area',
    dpe: 'Energy (DPE)', type: 'Type', garden: 'Garden', terrace: 'Terrace', pool: 'Pool', yes: 'Yes', no: 'No',
    description: 'Description', more: 'Read more', less: 'Show less',
    matching: 'Matching', matchingBy: 'Score and explanations calculated by HomeSync for your search.',
    criteria: { budget: 'Budget', type: 'Property type', envies: 'Your wishes', localisation: 'Location', surface: 'Area', marche: 'Market price', pieces: 'Rooms', dpe: 'Energy (DPE)', equipements: 'Features', travellers: 'Guests', voyageurs: 'Guests', rating: 'Rating', note: 'Rating', reviews: 'Reviews', avis: 'Reviews', price: 'Market price', prix: 'Market price', stay: 'Length of stay', séjour: 'Length of stay' },
    actions: 'Actions on this listing',
    favourites: 'Favourites', saved: 'Saved', gold: 'Gold', goldName: 'Gold favourite', goldHint: 'Gold marks your personal top picks.',
    compare: 'Compare', inCompare: 'In comparison', compareFull: max => `The comparison is full (${max} listings). Remove one to add this listing.`,
    ask: 'Ask a question', visit: 'Request a visit', newTab: '(opens the original listing in a new tab)',
    visitNote: 'You will contact the agency on the original listing.', visitNoUrl: 'Visit requests are unavailable: the link to the original listing is missing.',
    perNight: 'Price per night', night: 'night', minStay: 'Minimum stay', nights: n => `${n} night${n === 1 ? '' : 's'}`, fees: 'Fees and taxes are shown on the listing',
    guests: 'Guests', bedrooms: 'Bedrooms', studio: 'Studio', beds: 'Beds', baths: 'Bathrooms', rating: 'Rating', reviews: n => `${n} review${n === '1' ? '' : 's'}`, noReviews: 'No reviews yet',
    availability: 'Check availability', bookNote: site => (site ? `You will book on ${site}, the original listing.` : 'You will book on the original listing.'), availNoUrl: 'Availability can’t be checked: the link to the original listing is missing.',
    credit: { lead: 'Rental data: ', licence: ', licensed under ', when: d => ` — data collected in ${d}.` }, newTabShort: '(new tab)',
  },
  fr: {
    close: 'Fermer l’annonce', photos: n => `Photos de l’annonce (${n})`, prev: 'Photo précédente', next: 'Photo suivante',
    photoOf: (i, n) => `Photo ${i} sur ${n}`, noPhoto: 'Aucune photo pour cette annonce',
    home: 'Logement', placeTbc: 'Localisation à confirmer',
    price: 'Prix', charges: 'Charges', notSpecified: 'Non communiquées', total: 'Total TTC', chargesExcluded: 'hors charges', tbc: 'À confirmer',
    details: 'Caractéristiques', area: 'Surface', rooms: 'Pièces', ppm2: 'Prix au m²', calculated: 'calculé', calcHint: 'Calculé par HomeSync : prix ÷ surface',
    dpe: 'DPE (énergie)', type: 'Type', garden: 'Jardin', terrace: 'Terrasse', pool: 'Piscine', yes: 'Oui', no: 'Non',
    description: 'Description', more: 'Lire la suite', less: 'Réduire',
    matching: 'Matching', matchingBy: 'Score et explications calculés par HomeSync pour votre recherche.',
    criteria: { budget: 'Budget', type: 'Type de bien', envies: 'Vos envies', localisation: 'Localisation', surface: 'Surface', marche: 'Prix du marché', pieces: 'Pièces', dpe: 'DPE', equipements: 'Équipements', travellers: 'Voyageurs', voyageurs: 'Voyageurs', rating: 'Note', note: 'Note', reviews: 'Avis', avis: 'Avis', price: 'Prix du marché', prix: 'Prix du marché', stay: 'Durée du séjour', séjour: 'Durée du séjour' },
    actions: 'Actions sur cette annonce',
    favourites: 'Favoris', saved: 'Enregistré', gold: 'Gold', goldName: 'Favori Gold', goldHint: 'Gold désigne vos coups de cœur personnels.',
    compare: 'Comparer', inCompare: 'Dans le comparatif', compareFull: max => `Le comparatif est plein (${max} annonces). Retirez-en une pour ajouter celle-ci.`,
    ask: 'Poser une question', visit: 'Demander une visite', newTab: '(ouvre l’annonce d’origine dans un nouvel onglet)',
    visitNote: 'Vous contacterez l’agence sur l’annonce d’origine.', visitNoUrl: 'Demande de visite indisponible : le lien vers l’annonce d’origine manque.',
    perNight: 'Prix par nuit', night: 'nuit', minStay: 'Séjour minimum', nights: n => `${n} nuit${n > 1 ? 's' : ''}`, fees: 'Frais et taxes indiqués sur l’annonce',
    guests: 'Voyageurs', bedrooms: 'Chambres', studio: 'Studio', beds: 'Lits', baths: 'Salles de bain', rating: 'Note', reviews: n => `${n} avis`, noReviews: 'Pas encore d’avis',
    availability: 'Voir les disponibilités', bookNote: site => (site ? `Vous réserverez sur ${site}, l’annonce d’origine.` : 'Vous réserverez sur l’annonce d’origine.'), availNoUrl: 'Impossible de voir les disponibilités : le lien vers l’annonce d’origine manque.',
    credit: { lead: 'Données de locations : ', licence: ', licence ', when: d => ` — données collectées en ${d}.` }, newTabShort: '(nouvel onglet)',
  },
};
const LOCALE = { en: 'en-US', fr: 'fr-FR' };
const isNum = v => typeof v === 'number' && Number.isFinite(v);
// Espace fine (U+202F) presque invisible avec Outfit : on la remplace par une espace insécable normale.
const num = (v, lang) => v.toLocaleString(LOCALE[lang], { maximumFractionDigits: 2 }).replace(/\u202f/g, '\u00a0');
// Même écriture que le reste de HomeSync (« 820 000 € » / « 820,000 € »), espace insécable avant €.
const euros = (v, lang) => `${num(Math.round(v), lang)}\u00a0€`;
// Montant exact : entier sans décimales, sinon deux décimales (nuitée à 130,55 € : pas d'arrondi inventé).
const amount = (v, lang) => `${Number.isInteger(v) ? num(v, lang) : v.toLocaleString(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f/g, '\u00a0')}\u00a0€`;
const monthYear = (iso, lang) => { const m = /^(\d{4})-(\d{2})/.exec(iso || ''); return m ? new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(+m[1], +m[2] - 1, 15)) : null; };
const siteOf = url => { try { return /(^|\.)airbnb\./i.test(new URL(url).hostname) ? 'Airbnb' : null; } catch { return null; } };
const INSIDE_AIRBNB = 'https://insideairbnb.com/';
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
const dpeLetter = v => (typeof v === 'string' && /^[A-G]$/i.test(v.trim()) ? v.trim().toUpperCase() : null);
// Lien d'origine : http(s) uniquement (jamais de javascript: venu des données).
const safeUrl = v => (typeof v === 'string' && /^https?:\/\//i.test(v.trim()) ? v.trim() : null);
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// Icônes monochromes (couleur du texte).
const svg = (body, size = 18, extra) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{body}</svg>;
const HEART = 'M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9Z';
const STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z';
const I = {
  close: svg(<path d="M6 6l12 12M18 6 6 18" />, 20),
  prev: svg(<path d="m14.5 5-7 7 7 7" />, 20),
  next: svg(<path d="m9.5 5 7 7-7 7" />, 20),
  pin: svg(<><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>, 16),
  house: svg(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v12h14V9" /><path d="M10 21v-6h4v6" /></>, 40, { strokeWidth: 1.6 }),
  heart: svg(<path d={HEART} />),
  heartOn: svg(<path d={HEART} fill="currentColor" />),
  star: svg(<path d={STAR} />, 16),
  starOn: svg(<path d={STAR} fill="currentColor" />, 16),
  compare: svg(<><rect x="3" y="5" width="7" height="14" rx="1.5" /><rect x="14" y="5" width="7" height="14" rx="1.5" /></>),
  check: svg(<path d="m5 12.5 4.5 4.5L19 7.5" />),
  ask: svg(<><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M10.2 8.6a2 2 0 1 1 2.6 1.9c-.5.2-.8.6-.8 1.1v.3" /><path d="M12 14h.01" /></>),
  calendar: svg(<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>, 20),
  external: svg(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>, 16),
};

// Galerie : défilement horizontal aimanté, boutons et flèches du clavier, compteur.
function Gallery({ photos, name, tx }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState({});
  const n = photos.length;
  if (!n) return <div className="lp-gallery lp-gallery-empty">{I.house}<span>{tx.noPhoto}</span></div>;
  const go = i => {
    const el = track.current;
    if (!el) return;
    const j = Math.max(0, Math.min(n - 1, i));
    el.scrollTo({ left: j * el.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const onScroll = e => { const el = e.currentTarget; setIndex(Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth))))); };
  const onKeyDown = e => {
    const to = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: n - 1 }[e.key];
    if (to === undefined || n < 2) return;
    e.preventDefault();
    go(to);
  };
  return (
    <div className="lp-gallery" onKeyDown={onKeyDown}>
      <div className="lp-track" ref={track} onScroll={onScroll} tabIndex={0} role="group" aria-label={tx.photos(n)}>
        {photos.map((src, i) => <div className="lp-slide" key={src + i} aria-hidden={i === index ? undefined : true}>
          {I.house}
          {!broken[i] && <img src={src} alt={`${name} – ${i + 1}/${n}`} loading={i ? 'lazy' : 'eager'} decoding="async" draggable="false" onError={() => setBroken(b => ({ ...b, [i]: true }))} />}
        </div>)}
      </div>
      <span className="lp-ring" aria-hidden="true" />
      {n > 1 && <>
        <button type="button" className="lp-nav lp-prev" aria-label={tx.prev} aria-disabled={index === 0 || undefined} onClick={() => go(index - 1)}>{I.prev}</button>
        <button type="button" className="lp-nav lp-next" aria-label={tx.next} aria-disabled={index >= n - 1 || undefined} onClick={() => go(index + 1)}>{I.next}</button>
      </>}
      {n > 1 && <span className="lp-count" aria-hidden="true">{index + 1} / {n}</span>}
      {n > 1 && <span className="lp-sr" aria-live="polite">{tx.photoOf(index + 1, n)}</span>}
    </div>
  );
}

// Description : trois lignes, puis « Lire la suite » si elle est longue.
function Description({ text, tx, id }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 160;
  return (
    <div className="lp-desc">
      <h3 className="lp-h3">{tx.description}</h3>
      <p id={id} className={long && !open ? 'lp-clamp' : undefined}>{text}</p>
      {long && <button type="button" className="lp-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>{open ? tx.less : tx.more}</button>}
    </div>
  );
}

export default function ListingPanel({ listing, lang = 'en', favouriteType = null, busy = false, onClose, onToggleFavourite, inCompare = false, compareCount = 0, compareMax = 3, onToggleCompare, onAsk }) {
  const tx = TEXT[lang] || TEXT.en;
  const lg = TEXT[lang] ? lang : 'en';
  const uid = useId();
  const panel = useRef(null);
  const scroller = useRef(null);
  const title = useRef(null);
  const [bar, setBar] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;

  // À la fermeture, le focus revient à l'élément qui a ouvert le panneau (carte, carte d'annonce).
  useEffect(() => {
    const opener = document.activeElement;
    const node = panel.current;
    return () => {
      const now = document.activeElement;
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected && (!now || now === document.body || node?.contains(now))) opener.focus({ preventScroll: true });
    };
  }, []);
  // Échap ferme, sauf si une fenêtre modale est ouverte par-dessus ou si l'on écrit ailleurs.
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if ([...document.querySelectorAll('[aria-modal="true"]')].some(d => !panel.current?.contains(d))) return;
      const t = e.target;
      if (t instanceof HTMLElement && !panel.current?.contains(t) && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      close.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  // Nouvelle annonce : retour en haut, focus sur le titre.
  const id = listing?.id_source;
  useEffect(() => {
    if (id == null) return;
    scroller.current?.scrollTo({ top: 0 });
    title.current?.focus({ preventScroll: true });
  }, [id]);

  if (!listing) return null;
  const a = listing;
  const name = a.titre || a.type || tx.home;
  const photos = (Array.isArray(a.photos) ? a.photos : []).filter(p => typeof p === 'string' && p);
  const place = [a.quartier, a.ville, a.code_postal].filter(Boolean).join(' · ');
  const price = isNum(a.prix) && a.prix > 0 ? euros(a.prix, lg) : null;
  const charges = isNum(a.charges) ? euros(a.charges, lg) : null;
  const surface = isNum(a.surface) && a.surface > 0 ? a.surface : null;
  const ppm2 = price && surface ? euros(a.prix / surface, lg) : null;
  const dpe = dpeLetter(a.dpe);
  const yn = v => (v == null ? tx.tbc : v ? tx.yes : tx.no);
  const url = safeUrl(a.url_source);
  const saved = !!favouriteType;
  const gold = favouriteType === 'gold';
  const full = !inCompare && compareCount >= compareMax;
  const match = a.match && isNum(a.match.score) ? a.match : null;
  // Location de vacances : prix par nuit et données Inside Airbnb.
  const rental = a.unite_prix === 'nuit';
  const nightly = rental && isNum(a.prix) && a.prix > 0 ? amount(a.prix, lg) : null;
  const count = v => (isNum(v) && v > 0 ? num(v, lg) : tx.tbc);
  const credit = rental && (!a.source || /inside\s*airbnb/i.test(a.source));
  const collected = monthYear(a.date_donnees, lg);
  // Favori : un clic sur « Enregistré » retire le favori (classique ou Gold) ;
  // Gold : un clic l'ajoute (ou passe le favori en Gold), un second revient au favori classique.
  const toggleFav = () => { if (!busy) onToggleFavourite?.(saved ? favouriteType : 'classique'); };
  const toggleGold = () => { if (!busy) onToggleFavourite?.(gold ? 'classique' : 'gold'); };
  // Barre compacte (titre + fermer) dès que la galerie est passée sous le haut du panneau.
  const onScroll = e => { const s = e.currentTarget; const g = s.querySelector('.lp-gallery'); setBar(s.scrollTop > (g ? g.offsetHeight : 0) - 64); };

  return (
    <aside className="lp" ref={panel} aria-labelledby={`${uid}t`}>
      <div className={`lp-bar${bar ? ' lp-bar-on' : ''}`} aria-hidden="true"><span>{name}</span></div>
      <button type="button" className="lp-close" aria-label={tx.close} onClick={() => close.current?.()}>{I.close}</button>
      <div className="lp-scroll" ref={scroller} onScroll={onScroll}>
        <Gallery key={id} photos={photos} name={name} tx={tx} />
        <div className="lp-body">
          <h2 className="lp-title" id={`${uid}t`} ref={title} tabIndex={-1}>{name}</h2>
          <p className="lp-place">{I.pin}<span>{place || tx.placeTbc}</span></p>

          {rental ? <div className="lp-price">
            <dl>
              <div className="lp-total"><dt>{tx.perNight}</dt><dd>{nightly ? <>{nightly}<span className="lp-unit"> / {tx.night}</span></> : tx.tbc}</dd></div>
              <div><dt>{tx.minStay}</dt><dd>{isNum(a.min_nuits) && a.min_nuits > 0 ? tx.nights(a.min_nuits) : tx.tbc}</dd></div>
            </dl>
            <p className="lp-fees">{tx.fees}</p>
          </div> : <dl className="lp-price">
            <div><dt>{tx.price}</dt><dd>{price || tx.tbc}</dd></div>
            <div><dt>{tx.charges}</dt><dd className={charges ? undefined : 'lp-muted'}>{charges || tx.notSpecified}</dd></div>
            <div className="lp-total"><dt>{tx.total}</dt><dd>{price || tx.tbc}{price && <small>{tx.chargesExcluded}</small>}</dd></div>
          </dl>}

          <h3 className="lp-h3">{tx.details}</h3>
          {rental ? <dl className="lp-facts">
            <div><dt>{tx.guests}</dt><dd>{count(a.voyageurs)}</dd></div>
            <div><dt>{tx.bedrooms}</dt><dd>{a.chambres === 0 ? tx.studio : count(a.chambres)}</dd></div>
            <div><dt>{tx.beds}</dt><dd>{count(a.lits)}</dd></div>
            <div><dt>{tx.baths}</dt><dd>{a.salles_de_bain || tx.tbc}</dd></div>
            <div className="lp-wide"><dt>{tx.rating}</dt><dd>{isNum(a.note) ? <><span aria-hidden="true">★ </span>{num(a.note, lg)}{isNum(a.nb_avis) && <span className="lp-reviews"> ({tx.reviews(num(a.nb_avis, lg))})</span>}</> : isNum(a.nb_avis) && a.nb_avis > 0 ? tx.reviews(num(a.nb_avis, lg)) : tx.noReviews}</dd></div>
            <div className="lp-wide"><dt>{tx.type}</dt><dd>{a.type || tx.tbc}</dd></div>
          </dl> : <dl className="lp-facts">
            <div><dt>{tx.area}</dt><dd>{surface ? `${num(surface, lg)} m²` : tx.tbc}</dd></div>
            <div><dt>{tx.rooms}</dt><dd>{isNum(a.nb_pieces) && a.nb_pieces > 0 ? num(a.nb_pieces, lg) : tx.tbc}</dd></div>
            <div><dt>{tx.ppm2}</dt><dd>{ppm2 ? <>{ppm2}/m²<small title={tx.calcHint}>{tx.calculated}</small></> : tx.tbc}</dd></div>
            <div><dt>{tx.dpe}</dt><dd>{dpe ? <span className={`lp-dpe lp-dpe-${dpe}`}>{dpe}</span> : tx.tbc}</dd></div>
            <div className="lp-wide"><dt>{tx.type}</dt><dd>{a.type || a.type_bien || tx.tbc}</dd></div>
            <div className="lp-eq"><dt>{tx.garden}</dt><dd>{yn(a.jardin)}</dd></div>
            <div className="lp-eq"><dt>{tx.terrace}</dt><dd>{yn(a.terrasse)}</dd></div>
            <div className="lp-eq"><dt>{tx.pool}</dt><dd>{yn(a.piscine)}</dd></div>
          </dl>}
          {typeof a.description === 'string' && a.description.trim() && <Description key={id} text={a.description.trim()} tx={tx} id={`${uid}d`} />}

          {match && <section className="lp-match" aria-labelledby={`${uid}m`}>
            <div className="lp-match-head"><h3 className="lp-h3" id={`${uid}m`}>{tx.matching}</h3><strong className="lp-score">{Math.round(match.score)}<small>/100</small></strong></div>
            <p className="lp-match-by">{tx.matchingBy}</p>
            {Array.isArray(match.detail) && match.detail.length > 0 && <ul className="lp-criteria">{match.detail.map((d, i) => <li key={`${d.critere}-${i}`}>
              <div><span>{tx.criteria[d.critere] || cap(d.critere)}</span>{isNum(d.points) && <b>{num(d.points, lg)}/{isNum(d.max) ? num(d.max, lg) : d.max}</b>}</div>
              {d.explication && <p>{d.explication}</p>}
            </li>)}</ul>}
          </section>}

          <div className="lp-actions" role="group" aria-label={tx.actions}>
            <div className="lp-row" aria-busy={busy || undefined}>
              <button type="button" className="lp-btn lp-fav" aria-pressed={saved} aria-disabled={busy || undefined} onClick={toggleFav}>{saved ? I.heartOn : I.heart}<span>{saved ? tx.saved : tx.favourites}</span></button>
              <button type="button" className="lp-btn lp-gold" aria-pressed={gold} aria-disabled={busy || undefined} aria-label={tx.goldName} title={tx.goldHint} onClick={toggleGold}>{gold ? I.starOn : I.star}<span>{tx.gold}</span></button>
            </div>
            <div className="lp-row lp-row2">
              <button type="button" className="lp-btn lp-compare" aria-pressed={inCompare} aria-disabled={full || undefined} aria-describedby={full ? `${uid}f` : undefined} onClick={() => { if (!full) onToggleCompare?.(); }}>{inCompare ? I.check : I.compare}<span>{inCompare ? tx.inCompare : tx.compare}</span></button>
              <button type="button" className="lp-btn lp-ask" onClick={() => onAsk?.()}>{I.ask}<span>{tx.ask}</span></button>
            </div>
            {full && <p className="lp-note" id={`${uid}f`}>{tx.compareFull(compareMax)}</p>}
            {url
              ? <a className="lp-btn lp-visit" href={url} target="_blank" rel="noreferrer" aria-describedby={`${uid}v`}>{I.calendar}<span>{rental ? tx.availability : tx.visit}</span>{I.external}<span className="lp-sr">{tx.newTab}</span></a>
              : <button type="button" className="lp-btn lp-visit" aria-disabled="true" aria-describedby={`${uid}v`}>{I.calendar}<span>{rental ? tx.availability : tx.visit}</span></button>}
            <p className="lp-note" id={`${uid}v`}>{rental ? (url ? tx.bookNote(siteOf(url)) : tx.availNoUrl) : url ? tx.visitNote : tx.visitNoUrl}</p>
          </div>
          {credit && <p className="lp-credit">{tx.credit.lead}<a href={INSIDE_AIRBNB} target="_blank" rel="noreferrer">Inside Airbnb (insideairbnb.com)<span className="lp-sr"> {tx.newTabShort}</span></a>{tx.credit.licence}<a href={CC_BY} target="_blank" rel="noreferrer">CC BY 4.0<span className="lp-sr"> {tx.newTabShort}</span></a>{collected ? tx.credit.when(collected) : '.'}</p>}
        </div>
      </div>
    </aside>
  );
}
