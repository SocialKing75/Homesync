import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import FilterModal from './FilterModal';
import './Navbar.css';

export default function Navbar() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const initiales = user?.login?.slice(0, 2).toUpperCase() || 'US';

  return (
    <nav className="navbar-glass">
      <div className="nav-left">
        <button
          type="button"
          className="nav-avatar"
          onClick={() => navigate('/accueil')}
          aria-label="Accueil"
          style={{ width: 'auto', padding: '0 12px', borderRadius: '16px' }}
        >
          Home
        </button>
      </div>

      <button
        type="button"
        className="nav-logo"
        onClick={() => navigate('/accueil')}
        aria-label="Accueil"
      >
        <img src="/logo-toulon-ai.svg" alt="ToulonFind AI" className="nav-logo-img" />
      </button>

      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          className="filter-toggle-btn" 
          onClick={() => setIsFilterOpen(true)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '50%', backgroundColor: 'rgba(255, 87, 34, 0.1)', color: 'var(--neon-orange)' }}
          title="Modifier les filtres"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
        </button>
        <span className="nav-username">{user?.login}</span>
      </div>

      <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} />
    </nav>
  );
}
