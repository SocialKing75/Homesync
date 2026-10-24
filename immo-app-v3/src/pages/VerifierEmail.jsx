import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorText } from '../api';
import './Login.css';

/* Page ouverte depuis le lien de l'email de vérification. */
export default function VerifierEmail() {
  const [params] = useSearchParams();
  const [etat, setEtat] = useState({ statut: 'encours', message: 'Vérification de votre adresse…' });
  const envoye = useRef(false); // StrictMode monte deux fois : le jeton n'est utilisable qu'une fois

  useEffect(() => {
    if (envoye.current) return;
    envoye.current = true;
    const token = params.get('token');
    if (!token) {
      setEtat({ statut: 'erreur', message: 'Lien incomplet.' });
      return;
    }
    api('/api/auth/verify-email', { method: 'POST', auth: false, body: { token } }).then(r => {
      setEtat(r.ok
        ? { statut: 'ok', message: 'Adresse email vérifiée ! Retournez dans la conversation et connectez-vous pour voir vos annonces.' }
        : { statut: 'erreur', message: errorText(r.data, 'Lien invalide ou expiré.') });
    });
  }, [params]);

  return (
    <div className="landing-wrapper">
      <div className="landing-main" style={{ marginTop: 80 }}>
        <div className="landing-search-card" style={{ maxWidth: 520, textAlign: 'center' }}>
          <h2 className="card-title">
            {etat.statut === 'ok' ? '✅ Compte activé' : etat.statut === 'erreur' ? '⚠️ Vérification impossible' : 'Vérification…'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{etat.message}</p>
          {etat.statut !== 'encours' && (
            <Link to="/" className="primary-search-btn" style={{ display: 'block', textDecoration: 'none' }}>
              Retour à la recherche
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
