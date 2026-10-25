import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorText } from '../api';
import { T, getLang } from '../i18n';
import './HomeSync.css';

/* Page ouverte depuis le lien de l'email de vérification. */
export default function VerifierEmail() {
  const [params] = useSearchParams();
  const [etat, setEtat] = useState({ statut: 'encours', message: t.verifying });
  const envoye = useRef(false); // StrictMode monte deux fois : le jeton n'est utilisable qu'une fois

  useEffect(() => {
    if (envoye.current) return;
    envoye.current = true;
    const token = params.get('token');
    if (!token) {
      setEtat({ statut: 'erreur', message: t.linkIncomplete });
      return;
    }
    api('/api/auth/verify-email', { method: 'POST', auth: false, body: { token } }).then(r => {
      setEtat(r.ok
        ? { statut: 'ok', message: t.verified }
        : { statut: 'erreur', message: errorText(r.data, t.linkInvalid) });
    });
  }, [params, t]);

  return (
    <div className="hs hs-landing">
      <div className="hs-hero">
        <div className="hs-start" style={{ maxWidth: 520 }}>
          <h2>
            {etat.statut === 'ok' ? t.verifiedTitle : etat.statut === 'erreur' ? t.verifyFailed : t.verifyingTitle}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{etat.message}</p>
          {etat.statut !== 'encours' && (
            <Link to="/" className="hs-link" style={{ display: 'block' }}>
              {t.backToSearch}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
