import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { computeScoreDetailed, useApp } from '../context/AppContext';
import './PropertyDetails.css';

const formatPrice = (value) => Number(value || 0).toLocaleString('fr-FR');

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { annonces, favoris, profil, toggleFavori, isFavori } = useApp();
  const property = useMemo(
    () => [...annonces, ...favoris].find(item => String(item.id) === String(id) || String(item.id_source) === String(id)),
    [annonces, favoris, id],
  );

  if (!property) {
    return <div className="property-page"><Navbar /><main className="property-missing"><span className="page-kicker">Bien non disponible</span><h1>Cette annonce n’est plus dans votre sélection.</h1><p>Retournez aux correspondances pour explorer le catalogue national à jour.</p><button onClick={() => navigate('/matching')}>Voir les correspondances</button></main></div>;
  }

  const score = property.matchScore ?? property.backend_score ?? computeScoreDetailed(property, profil).total;
  const golden = score >= 80;
  const { criteria } = computeScoreDetailed(property, profil);
  const images = [property.img, ...(property.photos || [])].filter((image, index, array) => image && array.indexOf(image) === index);
  const mainImage = images[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80';
  const rooms = property.pieces || property.nb_pieces;
  const location = [property.ville, property.quartier].filter(Boolean).filter((item, index, array) => array.indexOf(item) === index).join(' · ');
  const facts = [
    property.surface && `${property.surface} m²`,
    rooms && `${rooms} pièce${Number(rooms) > 1 ? 's' : ''}`,
    property.type,
    property.dpe && `DPE ${property.dpe}`,
  ].filter(Boolean);

  return <div className="property-page">
    <Navbar />
    <main className="property-shell">
      <button className="property-back" onClick={() => navigate('/matching')}>Retour aux correspondances</button>
      <section className="property-hero">
        <div className="property-gallery"><img src={mainImage} alt={property.titre || property.type || 'Bien immobilier'} />{golden && <span className="property-priority">Correspondance prioritaire</span>}{images.length > 1 && <span className="property-photo-count">{images.length} photos</span>}</div>
        <article className="property-summary">
          <span className="page-kicker">{location || 'France'}</span>
          <h1>{property.titre || `${property.type || 'Bien immobilier'} à vendre`}</h1>
          <p className="property-price">{formatPrice(property.prix)} €</p>
          {property.prixM2 && <p className="property-price-note">{formatPrice(property.prixM2)} €/m²</p>}
          <div className="property-facts">{facts.map(fact => <span key={fact}>{fact}</span>)}</div>
          <div className={`property-score ${golden ? 'is-golden' : ''}`}><strong>{score}%</strong><span>compatibilité avec votre projet</span></div>
          <div className="property-actions">
            <button className="property-save" onClick={() => toggleFavori(property)}>{isFavori(property.id) ? 'Retirer des favoris' : 'Conserver ce bien'}</button>
            <button className="property-message" onClick={() => navigate('/messages')}>Préparer un message</button>
          </div>
          {property.url_source && <a className="property-source" href={property.url_source} target="_blank" rel="noreferrer">Consulter l’annonce source</a>}
        </article>
      </section>

      <section className="property-content">
        <article className="property-description"><span className="page-kicker">L’annonce</span><h2>À propos de ce bien</h2><p>{property.description || 'Les informations détaillées de ce bien sont disponibles auprès de l’annonceur. HomeSync le conserve dans votre sélection selon les critères de votre projet.'}</p>{property.url_source && <p className="property-data-note">Données issues du catalogue national et mises à jour selon la source de l’annonce.</p>}</article>
        <aside className={`property-match-panel ${golden ? 'is-golden' : ''}`}><span className="page-kicker">Lecture HomeSync</span><h2>{golden ? 'Un accord fort avec votre projet' : 'Les critères pris en compte'}</h2><div className="property-criteria">{criteria.slice(0, 4).map(criterion => <div key={criterion.label}><div><strong>{criterion.label}</strong><span>{criterion.detail}</span></div><b>{criterion.pts}/{criterion.max}</b></div>)}</div></aside>
      </section>
    </main>
  </div>;
}
