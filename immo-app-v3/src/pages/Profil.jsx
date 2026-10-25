import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useApp, QUARTIERS_LIST } from '../context/AppContext';
import './Profil.css';

const TYPES_BIEN = ['Appartement', 'Maison'];
const ACHAT_LOCATION = ['Achat', 'Location', 'Achat / Location'];

const ENVIRONNEMENTS = [
  { label: 'Mer', color: '#0ea5e9', bg: '#e0f2fe' },
  { label: 'Montagne', color: '#78716c', bg: '#f5f5f4' },
  { label: 'Campagne', color: '#22c55e', bg: '#dcfce7' },
  { label: 'Ville', color: '#6366f1', bg: '#eef2ff' },
];

export default function Profil() {
  const { profil, setProfil, user } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...profil });
  const [saved, setSaved] = useState(false);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const toggleEnv = (env) => {
    setForm(prev => ({
      ...prev,
      environnement: prev.environnement.includes(env)
        ? prev.environnement.filter(e => e !== env)
        : [...prev.environnement, env],
    }));
    setSaved(false);
  };

  const handleSave = () => {
    setProfil(form);
    setSaved(true);
    setTimeout(() => navigate('/recherche'), 900);
  };

  const selectedQuartiers = form.quartiers?.length || 0;
  const formatEuro = (value) => new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(value || 0);

  return (
    <div className="profil-wrapper">
      <Navbar />
      <div className="profil-content">
        <div className="profil-intro">
          <div>
            <span className="profil-eyebrow">Profil de projet</span>
            <h1>Mon projet immobilier</h1>
            <p>Les critères utilisés pour organiser votre recherche et vos correspondances.</p>
          </div>
          <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={handleSave}>
            {saved ? 'Préférences enregistrées' : 'Enregistrer les préférences'}
          </button>
        </div>

        <section className="profil-stats" aria-label="Synthèse du projet">
          <article><span className="stat-value">{formatEuro(form.prixMax)}</span><span className="stat-label">Budget maximum</span><i className="stat-bars navy" /></article>
          <article><span className="stat-value">T{form.pieces}</span><span className="stat-label">Configuration recherchée</span><i className="stat-bars violet" /></article>
          <article><span className="stat-value">{selectedQuartiers || 'France'}</span><span className="stat-label">{selectedQuartiers ? 'secteur(s) sélectionné(s)' : 'périmètre de recherche'}</span><i className="stat-bars copper" /></article>
        </section>

        <div className="profil-layout">
          <aside className="profil-summary">
            <div className="summary-avatar">{(user?.nom || user?.login || 'I').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}</div>
            <p className="summary-label">Projet actif</p>
            <h2>{user?.nom || user?.login || 'Votre projet'}</h2>
            <span className="summary-status">Recherche en cours</span>
            <button className="summary-edit" onClick={() => document.getElementById('pieces')?.focus()}>Modifier les préférences</button>
            <div className="summary-list">
              <div><span>Recherche</span><strong>{form.typeBien}</strong></div>
              <div><span>Localisation</span><strong>{selectedQuartiers ? `${selectedQuartiers} secteur${selectedQuartiers > 1 ? 's' : ''}` : 'Toute la France'}</strong></div>
              <div><span>Projet</span><strong>{form.achatLocation}</strong></div>
            </div>
            <div className="summary-tip">Les biens les plus compatibles seront prioritaires dans vos correspondances.</div>
          </aside>

          <div className="profil-card">
          <div className="profil-header">
            <div><h2 className="profil-title">Préférences de recherche</h2><p>Définissez les critères qui comptent vraiment pour vous.</p></div>
          </div>

          {/* Grille critères */}
          <div className="profil-grid">
            <div className="profil-field-box">
              <label className="box-label" htmlFor="pieces">Nombre de pièces</label>
              <input
                id="pieces"
                type="number"
                className="box-input"
                value={form.pieces}
                onChange={e => handleChange('pieces', parseInt(e.target.value) || 1)}
                min="1" max="10"
              />
            </div>

            <div className="profil-field-box">
              <label className="box-label" htmlFor="budget">Budget maximum</label>
              <input
                id="budget"
                type="number"
                className="box-input"
                value={form.prixMax}
                onChange={e => handleChange('prixMax', parseInt(e.target.value) || 0)}
                step="5000"
              />
            </div>

            <div className="profil-field-box">
              <label className="box-label" htmlFor="monthly">Mensualité maximum</label>
              <input
                id="monthly"
                type="number"
                className="box-input"
                value={form.mensualiteMax}
                onChange={e => handleChange('mensualiteMax', parseInt(e.target.value) || 0)}
                step="50"
              />
            </div>
          </div>

          {/* Quartier — multi-sélection */}
          <div className="profil-section">
            <div className="section-heading"><span className="field-label">Ville(s) ou secteur(s) recherché(s)</span><span className="selection-count">{selectedQuartiers ? `${selectedQuartiers} sélectionné${selectedQuartiers > 1 ? 's' : ''}` : 'Toute la France'}</span></div>
            <div className="quartier-choices">
              <button
                className={`tag-btn ${!form.quartiers?.length ? 'active-orange' : ''}`}
                onClick={() => handleChange('quartiers', [])}
              >Tout</button>
              {QUARTIERS_LIST.map(q => {
                const selected = form.quartiers?.includes(q);
                return (
                  <button
                    key={q}
                    className={`tag-btn ${selected ? 'active-orange' : ''}`}
                    onClick={() => {
                      const current = form.quartiers || [];
                      handleChange('quartiers', selected
                        ? current.filter(x => x !== q)
                        : [...current, q]
                      );
                    }}
                  >{q}</button>
                );
              })}
            </div>
            {!!form.quartiers?.length && (
              <p className="quartier-selection-info">Vous recevrez des recommandations ciblées pour ces secteurs.</p>
            )}
          </div>

          {/* Type de bien */}
          <div className="profil-inline-field">
            <span className="inline-label">Type de bien <small>Ce que vous souhaitez trouver</small></span>
            <div className="tag-choices">
              {TYPES_BIEN.map(t => (
                <button
                  key={t}
                  className={`tag-btn ${form.typeBien === t ? 'active-orange' : ''}`}
                  onClick={() => handleChange('typeBien', t)}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Achat / Location */}
          <div className="profil-inline-field">
            <span className="inline-label">Votre projet <small>Achat ou location</small></span>
            <div className="tag-choices">
              {ACHAT_LOCATION.map(t => (
                <button
                  key={t}
                  className={`tag-btn ${form.achatLocation === t ? 'active-orange' : ''}`}
                  onClick={() => handleChange('achatLocation', t)}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Environnement */}
          <div className="profil-section">
            <div className="section-heading"><span className="field-label">Cadre de vie</span><span className="selection-count">Plusieurs choix possibles</span></div>
            <div className="env-grid">
              {ENVIRONNEMENTS.map(env => {
                const active = form.environnement.includes(env.label);
                return (
                  <button
                    key={env.label}
                    className="env-btn"
                    style={{
                      background: active ? env.color : env.bg,
                      color: active ? 'white' : env.color,
                      borderColor: env.color,
                    }}
                    onClick={() => toggleEnv(env.label)}
                  >
                    <span className="env-emoji" aria-hidden="true" />
                    <span>{env.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="profil-footer"><span>Vos préférences sont enregistrées localement.</span><button className="text-save-btn" onClick={handleSave}>Sauvegarder et voir les résultats →</button></div>
        </div>
        </div>
      </div>
    </div>
  );
}
