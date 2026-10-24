import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useApp, QUARTIERS_LIST } from '../context/AppContext';
import './Profil.css';

const TYPES_BIEN = ['Appartement', 'Maison'];
const ACHAT_LOCATION = ['Achat', 'Location', 'Achat / Location'];

const ENVIRONNEMENTS = [
  { label: 'Mer',      emoji: '🌊', color: '#0ea5e9', bg: '#e0f2fe' },
  { label: 'Montagne', emoji: '⛰️',  color: '#78716c', bg: '#f5f5f4' },
  { label: 'Campagne', emoji: '🌿', color: '#22c55e', bg: '#dcfce7' },
  { label: 'Ville',    emoji: '🏙️', color: '#6366f1', bg: '#eef2ff' },
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
    setTimeout(() => navigate('/accueil'), 900);
  };

  return (
    <div className="profil-wrapper">
      <Navbar />
      <div className="profil-content">
        <div className="profil-card">

          {/* Header */}
          <div className="profil-header">
            <h2 className="profil-title">Profil · {user?.login}</h2>
            <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={handleSave}>
              {saved ? '✓ Sauvegardé' : 'Sauvegarder'}
            </button>
          </div>

          {/* Grille critères */}
          <div className="profil-grid">
            <div className="profil-field-box">
              <span className="box-label">Nb de pièces</span>
              <input
                type="number"
                className="box-input"
                value={form.pieces}
                onChange={e => handleChange('pieces', parseInt(e.target.value) || 1)}
                min="1" max="10"
              />
            </div>

            <div className="profil-field-box">
              <span className="box-label">Budget max (€)</span>
              <input
                type="number"
                className="box-input"
                value={form.prixMax}
                onChange={e => handleChange('prixMax', parseInt(e.target.value) || 0)}
                step="5000"
              />
            </div>

            <div className="profil-field-box">
              <span className="box-label">Mensualité max (€)</span>
              <input
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
            <span className="field-label">Quartier(s) recherché(s)</span>
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
              <p className="quartier-selection-info">
                {form.quartiers.length} quartier{form.quartiers.length > 1 ? 's' : ''} sélectionné{form.quartiers.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Type de bien */}
          <div className="profil-inline-field">
            <span className="inline-label">Type de bien</span>
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
            <span className="inline-label">Achat / Location</span>
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
            <span className="field-label">Environnement</span>
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
                    <span className="env-emoji">{env.emoji}</span>
                    <span>{env.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
