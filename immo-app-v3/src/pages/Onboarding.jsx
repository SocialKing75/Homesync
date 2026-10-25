import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeSyncLogo from '../components/HomeSyncLogo';
import './Onboarding.css';

const profiles = [
  {
    id: 'particulier',
    eyebrow: 'Particulier',
    title: 'Pour moi et mes proches',
    copy: 'Créez un projet commun, exprimez vos priorités et découvrez les biens qui conviennent à chacun.',
    points: ['Recherche partagée', 'Préférences communes'],
    cta: 'Commencer ma recherche',
  },
  {
    id: 'agence',
    eyebrow: 'Professionnel',
    title: 'Pour mon agence',
    copy: 'Structurez les recherches de vos clients et suivez les opportunités qui méritent votre attention.',
    points: ['Plusieurs projets', 'Suivi des dossiers'],
    cta: 'Accéder à l’espace agence',
  },
];

export default function Onboarding() {
  const [selected, setSelected] = useState('particulier');
  const navigate = useNavigate();

  return (
    <main className="onboarding-page">
      <div className="onboarding-image" aria-hidden="true" />
      <header className="onboarding-header">
        <button className="onboarding-brand" onClick={() => setSelected('particulier')} aria-label="Accueil HomeSync">
          <HomeSyncLogo />
        </button>
        <span className="onboarding-status">Recherche conversationnelle · Toute la France</span>
      </header>

      <section className="onboarding-content">
        <span className="onboarding-kicker">Immobilier, pensé pour les projets réels</span>
        <h1>Votre prochain lieu de vie commence par une <em>conversation.</em></h1>
        <p className="onboarding-lede">Décrivez votre besoin seul ou à plusieurs. HomeSync comprend les priorités de votre projet, pose les bonnes questions et organise les opportunités.</p>
        <p className="onboarding-prompt">Je cherche un logement en tant que…</p>

        <div className="profile-choice-grid">
          {profiles.map(profile => (
            <article key={profile.id} className={`profile-choice ${selected === profile.id ? 'selected' : ''}`}>
              <button className="profile-choice-main" onClick={() => setSelected(profile.id)}>
                <span className="choice-symbol" aria-hidden="true">{profile.id === 'particulier' ? 'P' : 'A'}</span>
                <span className="choice-eyebrow">{profile.eyebrow}</span>
                <h2>{profile.title}</h2>
                <p>{profile.copy}</p>
              </button>
              <div className="choice-footer">
                <span>{profile.points.join(' · ')}</span>
                <button onClick={() => navigate(profile.id === 'agence' ? '/agence' : '/recherche')}>{profile.cta}<span aria-hidden="true">→</span></button>
              </div>
            </article>
          ))}
        </div>
        <p className="onboarding-note">Un seul échange peut faire évoluer la recherche. Vos informations restent rattachées à votre projet.</p>
      </section>
    </main>
  );
}
