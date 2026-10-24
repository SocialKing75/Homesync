import { useEffect, useState } from 'react';
import { api, apiDownload, apiUpload, errorText } from '../api';

/* ── Dossier de candidature : profil (particulier / société), checklist des
   pièces, dépôt sécurisé, export « dossier prêt » pour la banque. ── */

const fmtTaille = (o) => (o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(o / 1024)} Ko`);

export default function Dossier({ onChange = () => {} }) {
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(null);   // id de la pièce en cours de dépôt
  const [dates, setDates] = useState({});     // date du document (pièces à durée de validité)

  const maj = (data) => { setEtat(data); onChange(data); };

  useEffect(() => {
    api('/api/dossier').then(r => (r.ok ? maj(r.data) : setErreur(errorText(r.data))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choisirProfil = async (profil) => {
    const r = await api('/api/dossier/profil', { method: 'PUT', body: { profil } });
    r.ok ? maj(r.data) : setErreur(errorText(r.data));
  };

  const deposer = async (piece, fichier) => {
    if (!fichier) return;
    setErreur('');
    setEnvoi(piece.id);
    const fd = new FormData();
    fd.append('piece', piece.id);
    fd.append('fichier', fichier);
    if (dates[piece.id]) fd.append('date_document', dates[piece.id]);
    const r = await apiUpload('/api/dossier/documents', fd);
    setEnvoi(null);
    r.ok ? maj(r.data) : setErreur(errorText(r.data, "Le dépôt n'a pas abouti."));
  };

  const supprimer = async (docId) => {
    const r = await api(`/api/dossier/documents/${docId}`, { method: 'DELETE' });
    r.ok ? maj(r.data) : setErreur(errorText(r.data));
  };

  if (!etat) return <p className="dossier-info">{erreur || 'Chargement du dossier…'}</p>;

  const obligatoires = etat.pieces.filter(p => p.obligatoire);
  const faites = obligatoires.filter(p => p.complete).length;

  return (
    <div className="dossier">
      <div className="dossier-profil">
        <span>Vous achetez en tant que</span>
        {[['particulier', 'Particulier'], ['societe', 'Société']].map(([id, label]) => (
          <button key={id} type="button" className={`dossier-choix${etat.profil === id ? ' on' : ''}`} onClick={() => choisirProfil(id)}>
            {label}
          </button>
        ))}
      </div>

      {etat.profil && (
        <>
          <div className="dossier-progression">
            <div className="dossier-barre"><span style={{ width: `${(faites / obligatoires.length) * 100}%` }} /></div>
            <span>{faites}/{obligatoires.length} pièces obligatoires</span>
          </div>

          <ul className="dossier-pieces">
            {etat.pieces.map(p => (
              <li key={p.id} className={p.complete ? 'complete' : ''}>
                <div className="dossier-piece-tete">
                  <span className="dossier-coche">{p.complete ? '✓' : ''}</span>
                  <span className="dossier-piece-label">
                    {p.label}
                    {!p.obligatoire && <em> — facultatif</em>}
                    {p.nombre > 1 && <em> ({p.documents.length}/{p.nombre})</em>}
                  </span>
                  {p.validite_jours && (
                    <input type="date" aria-label="Date du document" value={dates[p.id] || ''}
                      onChange={e => setDates({ ...dates, [p.id]: e.target.value })} />
                  )}
                  {(p.nombre === 1 || p.documents.length < p.nombre) && (
                    <label className="dossier-deposer">
                      {envoi === p.id ? 'Envoi…' : p.documents.length && p.nombre === 1 ? 'Remplacer' : 'Déposer'}
                      <input type="file" accept="application/pdf,image/jpeg,image/png" hidden disabled={envoi === p.id}
                        onChange={e => { deposer(p, e.target.files[0]); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
                {p.documents.map(d => (
                  <div key={d.id} className="dossier-fichier">
                    <button type="button" className="dossier-lien" onClick={() => apiDownload(`/api/dossier/documents/${d.id}`, d.nom)}>
                      📄 {d.nom}
                    </button>
                    <span>{fmtTaille(d.taille)}</span>
                    <button type="button" className="dossier-suppr" aria-label={`Supprimer ${d.nom}`} onClick={() => supprimer(d.id)}>✕</button>
                  </div>
                ))}
              </li>
            ))}
          </ul>

          {erreur && <p className="dossier-erreur">{erreur}</p>}

          <div className="dossier-actions">
            <button type="button" className="dossier-export" onClick={() => apiDownload('/api/dossier/export', 'dossier_financement.zip')}>
              ⬇ Télécharger mon dossier prêt pour la banque
            </button>
          </div>
        </>
      )}
      {!etat.profil && erreur && <p className="dossier-erreur">{erreur}</p>}

      <p className="dossier-rgpd">
        🔒 PDF, JPEG ou PNG, 10 Mo maximum. Vos pièces sont chiffrées et visibles par vous seul ;
        vous pouvez les supprimer à tout moment, et elles sont effacées avec votre compte.
      </p>
    </div>
  );
}
