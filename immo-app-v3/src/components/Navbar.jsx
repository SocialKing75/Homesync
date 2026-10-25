import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import HomeSyncLogo from './HomeSyncLogo';
import './Navbar.css';
import './NavbarActive.css';

export default function Navbar() {
  const { user, favoris } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const links = [
    { label: 'Recherche', path: '/recherche' },
    { label: 'Correspondances', path: '/matching' },
    { label: `Favoris${favoris?.length ? ` (${favoris.length})` : ''}`, path: '/favoris' },
    { label: 'Messages', path: '/messages' },
  ];

  return (
    <nav className="navbar-glass">
      <div className="navbar-inner">
        <div className="nav-brand-group">
          <button type="button" className="nav-logo" onClick={() => navigate('/')} aria-label="Retour à l’accueil HomeSync"><HomeSyncLogo /></button>
          <button type="button" className="nav-project" onClick={() => navigate('/recherche')}><span>PROJET ACTIF</span><strong>Mon prochain chez-moi</strong></button>
        </div>
        <div className="nav-links">
          {links.map((link) => (
            <button
              key={link.path}
              className={pathname === link.path ? 'active' : ''}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
        </div>
        <div className="nav-right"><button className="nav-invite" onClick={() => navigate('/recherche')}>Inviter</button><button onClick={() => navigate('/profil')} className="nav-username" title="Accéder au profil">{user?.nom || user?.login || 'Profil'}</button></div>
      </div>
    </nav>
  );
}
