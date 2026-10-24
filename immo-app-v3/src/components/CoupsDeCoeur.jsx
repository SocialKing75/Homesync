import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api, errorText, getToken } from '../api';
import Dossier from './Dossier';
import './CoupsDeCoeur.css';

/* ── Onglet « Coups de cœur » du dashboard : annonces likées, fiche de
   l'annonce, candidature (dossier complet exigé, complété sur place). ── */

const fmtPrix = (n) => (n ? `${Math.round(n).toLocaleString('fr-FR')} €` : 'Prix N/C');

export default function CoupsDeCoeur() {
  const [likes, setLikes] = useState(null);
  const [candidatures, setCandidatures] = useState({});
  const [filtre, setFiltre] = useState('tous');
  const [ouverte, setOuverte] = useState(null);     // like affiché en fiche
  const [dossierSeul, setDossierSeul] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = async () => {
    const [l, c] = await Promise.all([api('/api/likes'), api('/api/candidatures')]);
    if (!l.ok) return setErreur(errorText(l.data, 'Impossible de charger vos coups de cœur.'));
    setLikes(l.data);
    if (c.ok) setCandidatures(Object.fromEntries(c.data.map(x => [x.annonce_id, x])));
  };

  useEffect(() => { if (getToken()) charger(); }, []);

  if (!getToken()) {
    return (
      <div className="cdc-vide">
        <h2>Vos coups de cœur</h2>
        <p>Créez votre compte depuis l'assistant de recherche pour liker des annonces et y postuler.</p>
        <Link to="/" className="cdc-btn">Trouver des annonces</Link>
      </div>
    );
  }
  if (!likes) return <p className="cdc-info">{erreur || 'Chargement…'}</p>;

  const visibles = likes.filter(l => filtre === 'tous' || (filtre === 'gold' ? l.type === 'gold' : candidatures[l.annonce_id]));

  return (
    <div className="cdc">
      <div className="cdc-tete">
        <div className="cdc-filtres">
          {[['tous', `Tous (${likes.length})`], ['gold', `★ Gold (${likes.filter(l => l.type === 'gold').length})`],
            ['postule', `Candidatures (${Object.keys(candidatures).length})`]].map(([id, label]) => (
            <button key={id} type="button" className={filtre === id ? 'on' : ''} onClick={() => setFiltre(id)}>{label}</button>
          ))}
        </div>
        <button type="button" className="cdc-btn secondaire" onClick={() => setDossierSeul(true)}>📁 Mon dossier</button>
      </div>

      {visibles.length === 0 ? (
        <div className="cdc-vide">
          <p>{likes.length ? 'Aucune annonce dans ce filtre.' : 'Pas encore de coup de cœur : swipez des annonces depuis l\'assistant.'}</p>
          {!likes.length && <Link to="/" className="cdc-btn">Trouver des annonces</Link>}
        </div>
      ) : (
        <div className="cdc-grille">
          {visibles.map(l => {
            const a = l.annonce || {};
            return (
              <button key={l.annonce_id} type="button" className={`cdc-carte${l.type === 'gold' ? ' gold' : ''}`} onClick={() => setOuverte(l)}>
                <div className="cdc-photo">
                  {a.photos?.[0] ? <img src={a.photos[0]} alt="" loading="lazy" /> : <span>🏠</span>}
                  {l.type === 'gold' && <span className="cdc-badge-gold">★ Gold</span>}
                  {candidatures[l.annonce_id] && <span className="cdc-badge-postule">Candidature envoyée</span>}
                </div>
                <div className="cdc-carte-texte">
                  {l.annonce ? (
                    <>
                      <strong>{fmtPrix(a.prix)}</strong>
                      <span>{a.type_bien} · {Math.round(a.surface || 0)} m²</span>
                      <span className="cdc-lieu">{a.ville || a.quartier}</span>
                    </>
                  ) : (
                    <span className="cdc-lieu">Annonce plus disponible</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {ouverte && (
        <Fiche like={ouverte} candidature={candidatures[ouverte.annonce_id]} onClose={() => setOuverte(null)} onChange={charger} />
      )}

      {dossierSeul && (
        <Modale onClose={() => setDossierSeul(false)}>
          <h2>Mon dossier de candidature</h2>
          <Dossier />
        </Modale>
      )}
    </div>
  );
}

function Fiche({ like, candidature, onClose, onChange }) {
  const a = like.annonce || {};
  const photos = a.photos || [];
  const [photo, setPhoto] = useState(0);
  const [dossierOuvert, setDossierOuvert] = useState(false);
  const [dossierComplet, setDossierComplet] = useState(false);
  const [message, setMessage] = useState('');
  const [occupe, setOccupe] = useState(false);

  const postuler = async () => {
    setOccupe(true);
    setMessage('');
    const r = await api('/api/candidatures', { method: 'POST', body: { annonce_id: like.annonce_id } });
    setOccupe(false);
    if (r.ok) {
      setDossierOuvert(false);
      onChange();
    } else if (r.status === 400) {
      setDossierOuvert(true); // dossier incomplet : on le complète ici même
      setMessage('Complétez votre dossier pour postuler.');
    } else {
      setMessage(errorText(r.data));
    }
  };

  const retirer = async () => {
    await api(`/api/candidatures/${encodeURIComponent(like.annonce_id)}`, { method: 'DELETE' });
    onChange();
  };

  const retirerFavori = async () => {
    await api(`/api/likes/${encodeURIComponent(like.annonce_id)}`, { method: 'DELETE' });
    onClose();
    onChange();
  };

  if (!like.annonce) {
    // Annonce retirée du site depuis le like : on ne peut plus que la retirer des favoris
    return (
      <Modale onClose={onClose}>
        <h2>Annonce plus disponible</h2>
        <p className="cdc-description">Cette annonce a été retirée depuis que vous l'avez likée.</p>
        <button type="button" className="cdc-btn" onClick={retirerFavori}>Retirer des coups de cœur</button>
      </Modale>
    );
  }

  return (
    <Modale onClose={onClose} fiche>
        <div className="cdc-carrousel">
          {photos.length ? <img src={photos[photo]} alt="" /> : <span>🏠</span>}
          {photos.length > 1 && (
            <>
              <button type="button" className="prec" onClick={() => setPhoto(p => (p - 1 + photos.length) % photos.length)} aria-label="Photo précédente">‹</button>
              <button type="button" className="suiv" onClick={() => setPhoto(p => (p + 1) % photos.length)} aria-label="Photo suivante">›</button>
              <span className="cdc-compteur">{photo + 1}/{photos.length}</span>
            </>
          )}
        </div>

        <div className="cdc-fiche-texte">
          <p className="cdc-fiche-prix">{fmtPrix(a.prix)}{like.type === 'gold' && <span className="cdc-badge-gold inline">★ Gold</span>}</p>
          <h2>{a.titre || a.type_bien}</h2>
          <div className="cdc-badges">
            {a.ville && <span>{a.ville}{a.code_postal ? ` (${a.code_postal})` : ''}</span>}
            {a.quartier && <span>{a.quartier}</span>}
            <span>{Math.round(a.surface || 0)} m²</span>
            {a.nb_pieces && <span>{a.nb_pieces} pièces</span>}
            {a.dpe && <span>DPE {a.dpe}</span>}
            {a.jardin && <span>🌳 Jardin</span>}
            {a.terrasse && <span>☀️ Terrasse</span>}
            {a.piscine && <span>🏊 Piscine</span>}
          </div>
          {a.description && <p className="cdc-description">{a.description}</p>}
          {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="cdc-lien">Voir l'annonce d'origine ↗</a>}

          <div className="cdc-fiche-actions">
            {candidature ? (
              <>
                <span className="cdc-postule">✓ Candidature envoyée le {new Date(candidature.envoyee_le).toLocaleDateString('fr-FR')}</span>
                <button type="button" className="cdc-btn secondaire" onClick={retirer}>Retirer ma candidature</button>
              </>
            ) : (
              <button type="button" className="cdc-btn" onClick={postuler} disabled={occupe || (dossierOuvert && !dossierComplet)}>
                {occupe ? '…' : dossierOuvert ? 'Envoyer ma candidature' : 'Postuler à cette annonce'}
              </button>
            )}
            <button type="button" className="cdc-lien-btn" onClick={retirerFavori}>Retirer des coups de cœur</button>
          </div>
          {message && <p className="cdc-message">{message}</p>}

          {dossierOuvert && !candidature && <Dossier onChange={d => setDossierComplet(d.complet)} />}
        </div>
    </Modale>
  );
}

// Rendue dans <body> : au-dessus de la navbar quel que soit le conteneur du dashboard
function Modale({ onClose, fiche = false, children }) {
  return createPortal(
    <div className="cdc-modale" onClick={onClose}>
      <div className={`cdc-modale-contenu${fiche ? ' fiche' : ''}`} onClick={e => e.stopPropagation()}>
        <button type="button" className="cdc-fermer" onClick={onClose} aria-label="Fermer">✕</button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
