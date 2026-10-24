import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorText, getToken } from '../api';
import './Decouvrir.css';

/* ── Découverte des annonces en mode swipe (façon Tinder) ──
   • glisser à droite = like, à gauche = dislike (l'annonce ne reviendra plus)
   • glisser vers le haut ou ⓘ = description complète
   • toucher le bord gauche / droit de la photo = photo précédente / suivante
   • clavier : ← dislike, → like, ↑ infos, Entrée gold */

const SEUIL_SWIPE = 110;
const fmtPrix = (n) => (n ? `${Math.round(n).toLocaleString('fr-FR')} €` : 'Prix N/C');

export default function Decouvrir() {
  const { searchId } = useParams();
  const navigate = useNavigate();
  const [annonces, setAnnonces] = useState(null);
  const [erreur, setErreur] = useState('');
  const [index, setIndex] = useState(0);
  const [photo, setPhoto] = useState(0);
  const [infos, setInfos] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0, actif: false });
  const [sortie, setSortie] = useState(null); // 'like' | 'gold' | 'dislike' pendant l'animation
  const [bilan, setBilan] = useState({ like: 0, gold: 0, dislike: 0 });
  const depart = useRef(null);

  useEffect(() => {
    if (!getToken()) {
      navigate('/', { replace: true });
      return;
    }
    api(`/api/chat/resultats/${searchId}?a_swiper=true`).then(r => {
      if (r.status === 401) return navigate('/', { replace: true });
      if (!r.ok) return setErreur(errorText(r.data, 'Impossible de charger les annonces.'));
      setAnnonces(r.data.annonces);
    });
  }, [searchId, navigate]);

  const annonce = annonces?.[index];
  const suivante = annonces?.[index + 1];
  const photos = annonce?.photos || [];

  const decider = useCallback(async (choix) => {
    if (!annonce || sortie) return;
    setSortie(choix);
    setInfos(false);
    const id = encodeURIComponent(annonce.id_source);
    const requete = choix === 'dislike'
      ? api(`/api/dislikes/${id}`, { method: 'PUT' })
      : api(`/api/likes/${id}/${choix === 'gold' ? 'gold' : 'classique'}`, { method: 'PUT' });
    setBilan(b => ({ ...b, [choix]: b[choix] + 1 }));
    setTimeout(() => {
      setIndex(i => i + 1);
      setPhoto(0);
      setDrag({ x: 0, y: 0, actif: false });
      setSortie(null);
    }, 280);
    const r = await requete;
    if (!r.ok) setErreur(errorText(r.data, "Votre choix n'a pas pu être enregistré."));
  }, [annonce, sortie]);

  const changerPhoto = (sens) => setPhoto(p => Math.min(Math.max(p + sens, 0), Math.max(photos.length - 1, 0)));

  // Clavier
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') decider('like');
      else if (e.key === 'ArrowLeft') decider('dislike');
      else if (e.key === 'ArrowUp') setInfos(true);
      else if (e.key === 'ArrowDown' || e.key === 'Escape') setInfos(false);
      else if (e.key === 'Enter') decider('gold');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decider]);

  // Glisser (souris et tactile via Pointer Events)
  const onPointerDown = (e) => {
    if (sortie || infos) return;
    depart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, actif: true });
  };

  const onPointerMove = (e) => {
    if (!depart.current) return;
    setDrag({ x: e.clientX - depart.current.x, y: e.clientY - depart.current.y, actif: true });
  };

  const onPointerUp = (e) => {
    if (!depart.current) return;
    const { x, y } = drag;
    const rect = e.currentTarget.getBoundingClientRect();
    const tap = Math.abs(x) < 8 && Math.abs(y) < 8;
    depart.current = null;
    if (tap) {
      setDrag({ x: 0, y: 0, actif: false });
      const relatif = (e.clientX - rect.left) / rect.width;
      if (relatif < 0.35) changerPhoto(-1);
      else if (relatif > 0.65) changerPhoto(1);
      return;
    }
    if (x > SEUIL_SWIPE) return decider('like');
    if (x < -SEUIL_SWIPE) return decider('dislike');
    if (y < -SEUIL_SWIPE && Math.abs(x) < SEUIL_SWIPE) setInfos(true);
    setDrag({ x: 0, y: 0, actif: false });
  };

  if (erreur && !annonces) {
    return <Ecran titre="Oups" texte={erreur} />;
  }
  if (!annonces) {
    return <Ecran titre="Chargement…" texte="Préparation de vos annonces." />;
  }
  if (!annonce) {
    return (
      <Ecran
        titre={annonces.length ? 'Vous avez tout vu !' : 'Aucune nouvelle annonce'}
        texte={annonces.length
          ? `${bilan.like + bilan.gold} coup${bilan.like + bilan.gold > 1 ? 's' : ''} de cœur (dont ${bilan.gold} gold) · ${bilan.dislike} annonce${bilan.dislike > 1 ? 's' : ''} écartée${bilan.dislike > 1 ? 's' : ''}.`
          : 'Toutes les annonces de cette recherche ont déjà été likées ou écartées.'}
      />
    );
  }

  const dx = sortie === 'like' || sortie === 'gold' ? 600 : sortie === 'dislike' ? -600 : drag.x;
  const dy = sortie === 'gold' ? -500 : sortie ? drag.y : drag.actif ? Math.min(drag.y, 0) * 0.4 : 0;
  const tampon = sortie || (drag.x > 40 ? 'like' : drag.x < -40 ? 'dislike' : null);

  return (
    <div className="swipe-page">
      <header className="swipe-header">
        <Link to="/" className="swipe-back">← Ma recherche</Link>
        <span className="swipe-compteur">{index + 1} / {annonces.length}</span>
        <Link to="/accueil?tab=favoris" className="swipe-back">❤ Coups de cœur</Link>
      </header>

      <div className="swipe-pile">
        {suivante && (
          <div className="swipe-carte swipe-carte-dessous">
            <Photo url={suivante.photos?.[0]} />
          </div>
        )}

        <div
          className={`swipe-carte${drag.actif ? '' : ' anime'}`}
          style={{ transform: `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Photo url={photos[photo]} />

          {photos.length > 1 && (
            <div className="swipe-progress">
              {photos.map((_, i) => <span key={i} className={i === photo ? 'on' : ''} />)}
            </div>
          )}

          {tampon && <div className={`swipe-tampon ${tampon}`}>{{ like: 'J’AIME', gold: 'GOLD', dislike: 'NON' }[tampon]}</div>}

          <div className="swipe-legende">
            <p className="swipe-prix">{fmtPrix(annonce.prix)}</p>
            <p className="swipe-titre">{annonce.type} · {Math.round(annonce.surface || 0)} m²</p>
            <p className="swipe-lieu">📍 {annonce.ville}{annonce.quartier && annonce.quartier !== annonce.ville ? ` · ${annonce.quartier}` : ''}</p>
            <button type="button" className="swipe-plus" onPointerDown={e => e.stopPropagation()} onClick={() => setInfos(true)}>
              Glissez vers le haut pour plus d'infos ⌃
            </button>
          </div>

          {infos && (
            <div className="swipe-infos" onPointerDown={e => e.stopPropagation()}>
              <button type="button" className="swipe-infos-fermer" onClick={() => setInfos(false)} aria-label="Fermer">⌄</button>
              <h2>{annonce.titre || annonce.type}</h2>
              <p className="swipe-infos-prix">{fmtPrix(annonce.prix)}{annonce.prix && annonce.surface ? ` · ${Math.round(annonce.prix / annonce.surface).toLocaleString('fr-FR')} €/m²` : ''}</p>
              <div className="swipe-badges">
                <span>{annonce.ville}{annonce.code_postal ? ` (${annonce.code_postal})` : ''}</span>
                {annonce.quartier && <span>{annonce.quartier}</span>}
                {annonce.nb_pieces && <span>{annonce.nb_pieces} pièce{annonce.nb_pieces > 1 ? 's' : ''}</span>}
                <span>{Math.round(annonce.surface || 0)} m²</span>
                {annonce.dpe && <span>DPE {annonce.dpe}</span>}
                {annonce.jardin && <span>🌳 Jardin</span>}
                {annonce.terrasse && <span>☀️ Terrasse</span>}
                {annonce.piscine && <span>🏊 Piscine</span>}
              </div>
              <p className="swipe-description">{annonce.description || 'Pas de description.'}</p>
              <a href={annonce.url_source} target="_blank" rel="noreferrer" className="swipe-lien">Voir l'annonce complète ↗</a>
            </div>
          )}
        </div>
      </div>

      {erreur && <p className="swipe-erreur">{erreur}</p>}

      <div className="swipe-actions">
        <button type="button" className="swipe-btn dislike" onClick={() => decider('dislike')} aria-label="Ne plus voir cette annonce">✕</button>
        <button type="button" className="swipe-btn gold" onClick={() => decider('gold')} aria-label="Like gold">★</button>
        <button type="button" className="swipe-btn infos" onClick={() => setInfos(v => !v)} aria-label="Plus d'infos">i</button>
        <button type="button" className="swipe-btn like" onClick={() => decider('like')} aria-label="J'aime">♥</button>
      </div>
    </div>
  );
}

function Photo({ url }) {
  const [cassee, setCassee] = useState(false);
  useEffect(() => setCassee(false), [url]);
  return url && !cassee
    ? <img className="swipe-photo" src={url} alt="" draggable={false} onError={() => setCassee(true)} />
    : <div className="swipe-photo swipe-photo-vide">🏠</div>;
}

function Ecran({ titre, texte }) {
  return (
    <div className="swipe-page">
      <div className="swipe-ecran">
        <h1>{titre}</h1>
        <p>{texte}</p>
        <Link to="/accueil?tab=favoris" className="swipe-ecran-btn">Voir mes coups de cœur et postuler</Link>
        <Link to="/" className="swipe-ecran-lien">Retour à ma recherche</Link>
      </div>
    </div>
  );
}
