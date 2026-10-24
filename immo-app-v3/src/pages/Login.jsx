import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Login.css';

export default function Login() {
  const { profil, setProfil, setUser } = useApp();

  const [typeBien, setTypeBien] = useState(profil?.typeBien?.toLowerCase() || 'appartement');
  const [typeAppartement, setTypeAppartement] = useState(profil?.typeAppartement || []);
  const [budgetMax, setBudgetMax] = useState(profil?.prixMax?.toString() || '');
  const [environnement, setEnvironnement] = useState(profil?.environnement?.[0]?.toLowerCase() || 'urbain');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const toggleTypeAppartement = (type) => {
    setTypeAppartement(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const mapTypeBien = (type) => {
    if (type === 'appartement') return 'Appartement';
    if (type === 'maison') return 'Maison';
    return 'Tous';
  };

  const mapEnvironnement = (env) => {
    if (env === 'urbain') return ['Ville', 'Centre-Ville'];
    if (env === 'periurbain') return ['Périurbain', 'Résidentiel'];
    if (env === 'rural') return ['Rural', 'Campagne'];
    return ['Ville'];
  };

  const getPiecesFromTypes = (types) => {
    if (!types.length) return 3;
    const nums = types.map(t => Number.parseInt(t.replace('T', ''), 10));
    return Math.min(...nums);
  };

  const handleSubmit = () => {
    if (!typeBien) {
      setError('Veuillez sélectionner un type de bien.');
      return;
    }
    if ((typeBien === 'appartement' || typeBien === 'les-deux') && typeAppartement.length === 0) {
      setError("Veuillez sélectionner au moins un type d'appartement.");
      return;
    }
    if (!budgetMax) {
      setError('Veuillez indiquer votre budget maximum.');
      return;
    }
    if (!environnement) {
      setError('Veuillez sélectionner un environnement.');
      return;
    }

    const newProfil = {
      ...profil,
      typeBien: mapTypeBien(typeBien),
      typeAppartement,
      prixMax: Number.parseInt(budgetMax, 10),
      pieces: getPiecesFromTypes(typeAppartement),
      environnement: mapEnvironnement(environnement),
    };

    setProfil(newProfil);
    setUser({ profil: newProfil });
    navigate('/accueil');
  };

  return (
    <div className="landing-wrapper">
      <div className="landing-hero" style={{ backgroundImage: "url('/hero_bg.png')" }}>
        <header className="landing-header">
          <div className="landing-logo">
            <img src="/logo-toulon-ai.svg" alt="ToulonFIND AI" style={{ height: '36px', filter: 'brightness(0) invert(1)' }} />
          </div>
        </header>

        <div className="hero-content">
          <h1 className="hero-title">Trouver le bon bien<br/>au bon prix</h1>
          
          <div className="hero-pill-toggle">
            <button 
              className={`pill-btn ${typeBien === 'appartement' ? 'active' : ''}`}
              onClick={() => setTypeBien('appartement')}
            >
              Appartement
            </button>
            <button 
              className={`pill-btn ${typeBien === 'maison' ? 'active' : ''}`}
              onClick={() => setTypeBien('maison')}
            >
              Maison
            </button>
            <button 
              className={`pill-btn ${typeBien === 'les-deux' ? 'active' : ''}`}
              onClick={() => setTypeBien('les-deux')}
            >
              Les deux
            </button>
          </div>
        </div>
      </div>

      <div className="landing-main">
        <div className="landing-search-card">
          <h2 className="card-title">Affinez vos critères de recherche</h2>
          
          {(typeBien === 'appartement' || typeBien === 'les-deux') && (
            <div className="form-group">
              <label>Type de bien ciblé</label>
              <div className="chips-container">
                {['T2', 'T3', 'T4', 'T5'].map(type => (
                  <button
                    type="button"
                    key={type}
                    className={`chip-btn ${typeAppartement.includes(type) ? 'active' : ''}`}
                    onClick={() => toggleTypeAppartement(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="budget-input">Budget maximum</label>
              <div className="input-with-icon">
                <input
                  id="budget-input"
                  type="number"
                  placeholder="Ex: 300000"
                  value={budgetMax}
                  onChange={e => setBudgetMax(e.target.value)}
                />
                <span className="input-suffix">€</span>
              </div>
            </div>

            <div className="form-group flex-1">
              <label>Secteur géographique</label>
              <div className="select-wrapper">
                <select value={environnement} onChange={e => setEnvironnement(e.target.value)}>
                  <option value="" disabled>Choisir un environnement...</option>
                  <option value="urbain">Urbain (Ville, Centre)</option>
                  <option value="periurbain">Périurbain (Résidentiel)</option>
                  <option value="rural">Rural (Campagne)</option>
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button className="primary-search-btn" onClick={handleSubmit}>
            Lancer la recherche
          </button>
        </div>
        
        <div className="landing-footer-teaser">
          {/* Subtle teaser for the AI dashboard to make the landing complete */}
          <p className="teaser-title">Les meilleures opportunités à Toulon identifiées par notre IA</p>
          <p className="teaser-sub">Remplissez vos critères pour accéder au dashboard prédictif.</p>
        </div>
      </div>
    </div>
  );
}
