import { useState } from 'react';
import { useApp, QUARTIERS_LIST } from '../context/AppContext';
import './FilterModal.css';

export default function FilterModal({ isOpen, onClose }) {
  const { profil, setProfil } = useApp();

  // Local state to avoid committing changes until the user clicks "Appliquer"
  const [localProfil, setLocalProfil] = useState(profil);
  const [qSearch, setQSearch] = useState('');

  const filteredQuartiers = qSearch
    ? QUARTIERS_LIST.filter(q => q.toLowerCase().includes(qSearch.toLowerCase()))
    : QUARTIERS_LIST;

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setLocalProfil(prev => ({ ...prev, [field]: value }));
  };

  const toggleQuartier = (q) => {
    setLocalProfil(prev => {
      const qts = prev.quartiers || [];
      if (qts.includes(q)) {
        return { ...prev, quartiers: qts.filter(x => x !== q) };
      }
      return { ...prev, quartiers: [...qts, q] };
    });
  };

  const applyFilters = () => {
    setProfil(localProfil);
    onClose();
  };

  return (
    <div className="filter-modal-backdrop" onClick={onClose}>
      <div className="filter-modal" onClick={e => e.stopPropagation()}>
        
        <div className="filter-modal-header">
          <h2>Profil & Critères de recherche</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="filter-modal-body">
          <div className="form-group">
            <label>Projet</label>
            <div className="segmented-control">
              {['Achat', 'Location', 'Achat / Location'].map(opt => (
                <button
                  key={opt}
                  className={localProfil.achatLocation === opt ? 'active' : ''}
                  onClick={() => handleChange('achatLocation', opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Budget Maximum : <strong>{localProfil.prixMax.toLocaleString('fr-FR')} €</strong></label>
            <input 
              type="range" 
              min="100000" max="1500000" step="10000"
              value={localProfil.prixMax}
              onChange={(e) => handleChange('prixMax', Number(e.target.value))}
            />
          </div>

          <div className="form-group row">
            <div className="col">
              <label>Type de bien</label>
              <select value={localProfil.typeBien} onChange={(e) => handleChange('typeBien', e.target.value)}>
                <option value="Appartement">Appartement</option>
                <option value="Maison">Maison</option>
                <option value="Loft">Loft</option>
              </select>
            </div>
            <div className="col">
              <label>Nombre de pièces</label>
              <select value={localProfil.pieces} onChange={(e) => handleChange('pieces', Number(e.target.value))}>
                <option value={1}>1 pièce (T1)</option>
                <option value={2}>2 pièces (T2)</option>
                <option value={3}>3 pièces (T3)</option>
                <option value={4}>4 pièces (T4)</option>
                <option value={5}>5 pièces et +</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ margin: 0 }}>Quartiers de prédilection ({(localProfil.quartiers || []).length} / 43)</label>
              {(localProfil.quartiers || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => setLocalProfil(prev => ({ ...prev, quartiers: [] }))}
                  style={{ background: 'none', border: 'none', color: 'var(--neon-orange)', fontSize: '12px', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                >
                  Tout effacer
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="🔍 Filtrer parmi les 43 quartiers de Toulon..."
              value={qSearch}
              onChange={(e) => setQSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginBottom: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-body, #ffffff)',
                color: 'var(--text-color, #0f172a)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <div className="quartiers-tags" style={{ maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
              {filteredQuartiers.map(q => (
                <span 
                  key={q} 
                  className={`quartier-tag ${(localProfil.quartiers || []).includes(q) ? 'active' : ''}`}
                  onClick={() => toggleQuartier(q)}
                >
                  {q}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="filter-modal-footer">
          <button className="btn-cancel" onClick={onClose}>Annuler</button>
          <button className="btn-apply" onClick={applyFilters}>Appliquer Profil</button>
        </div>
      </div>
    </div>
  );
}
