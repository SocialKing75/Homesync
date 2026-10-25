import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { computeScore, useApp } from '../context/AppContext';
import './Matching.css';

export default function Matching() {
  const { annonces, profil, favoris, toggleFavori, isFavori, activeSearch } = useApp();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [celebrated, setCelebrated] = useState(false);
  const ranked = useMemo(() => annonces.map(a => ({ ...a, matchScore: computeScore(a, profil) })).sort((a, b) => b.matchScore - a.matchScore), [annonces, profil]);
  const property = ranked[index];
  const next = () => { setCelebrated(false); setIndex(current => Math.min(current + 1, Math.max(ranked.length - 1, 0))); };
  if (!property) return <div className="matching-page"><Navbar /><div className="matching-empty">Chargement des correspondances…</div></div>;
  const isGolden = property.matchScore >= 80;
  const details = [
    ['Budget', property.prix <= profil.prixMax ? 'Dans votre budget' : 'À étudier'],
    ['Localisation', profil.quartiers?.length ? (property.ville || property.quartier) : 'Secteur ouvert'],
    ['Surface', `${property.surface} m²`],
    ['Marché', property.prixM2 ? `${property.prixM2.toLocaleString('fr-FR')} €/m²` : 'Donnée marché disponible'],
  ];
  const keepProperty = () => { if (!isFavori(property.id)) toggleFavori(property); if (isGolden) setCelebrated(true); };
  const propertyId = encodeURIComponent(property.id);
  return <div className="matching-page"><Navbar /><main className="matching-shell">
    <header className="matching-header"><div><span className="page-kicker">{activeSearch?.query ? 'Recherche active' : 'Sélection personnalisée'}</span><h1>{activeSearch?.query ? 'Correspondances de votre conversation' : 'Les biens les plus compatibles'}</h1><p>{activeSearch?.query ? `Résultats issus de votre demande : « ${activeSearch.query} »` : 'Les correspondances prioritaires dépassent 80 % : elles répondent aux critères essentiels de votre projet.'}</p>{activeSearch?.query && <button className="matching-edit-search" onClick={() => navigate('/recherche')}>Modifier la recherche</button>}</div><div className="matching-counter"><strong>{index + 1}</strong><span>sur {activeSearch?.resultCount || ranked.length} correspondances</span></div></header>
    <section className="matching-stage"><article className={`match-card ${isGolden ? 'golden-match' : ''} ${celebrated ? 'is-celebrating' : ''}`}><div className="match-image"><img src={property.img || property.photos?.[0]} alt={property.titre || property.type}/>{isGolden && <span className="golden-label">Correspondance prioritaire</span>}<span className="match-score">{property.matchScore}%<small>compatibilité</small></span></div><div className="match-info"><div className="match-title"><div><p>{property.ville || property.quartier}</p><h2>{property.titre || `${property.type} · ${property.pieces} pièces`}</h2></div><strong>{property.prix?.toLocaleString('fr-FR')} €</strong></div><div className="match-metadata"><span>{property.surface} m²</span><span>{property.pieces || property.nb_pieces} pièces</span><span>{property.prixM2?.toLocaleString('fr-FR')} €/m²</span></div><div className="match-actions"><button className="secondary-match" onClick={next}>Passer</button><button className="primary-match" onClick={keepProperty}>{isFavori(property.id) ? 'Dans vos favoris' : isGolden ? 'Conserver cette priorité' : 'Conserver ce bien'}</button><button className="detail-match" onClick={() => navigate(`/bien/${propertyId}`)}>Voir le détail</button></div></div>{celebrated && <div className="match-confirmation"><strong>Bien ajouté à vos priorités</strong><span>Retrouvez-le dans vos favoris pour le comparer ou contacter l’agence.</span></div>}</article>
      <aside className={`match-explanation ${isGolden ? 'golden-explanation' : ''}`}><span className="page-kicker">Pourquoi ce bien</span><h2>{isGolden ? 'Une correspondance prioritaire' : 'Correspondance avec votre projet'}</h2><p>Le score combine les critères renseignés, la qualité de la localisation et les repères de prix.</p><div className="criteria-list">{details.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="match-saved"><span>{favoris.length}</span><p>biens conservés pour comparaison et prise de contact.</p></div></aside>
    </section>
  </main></div>;
}
