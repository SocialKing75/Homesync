import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import HomeSyncLogo from './HomeSyncLogo';
import './Navbar.css';

export default function Navbar() {
  const { user, favoris } = useApp();
  const navigate = useNavigate();

  return (
    <nav className="navbar-glass">
      <div className="navbar-inner">
        <div className="nav-brand-group">
          <button type="button" className="nav-logo" onClick={() => navigate('/')} aria-label="Retour à l’accueil HomeSync"><HomeSyncLogo /></button>
          <button type="button" className="nav-project" onClick={() => navigate('/recherche')}><span>PROJET ACTIF</span><strong>Mon prochain chez-moi</strong></button>
        </div>
        <div className="nav-links"><button onClick={() => navigate('/recherche')}>Recherche</button><button onClick={() => navigate('/matching')}>Correspondances</button><button onClick={() => navigate('/favoris')}>Favoris {favoris?.length ? `(${favoris.length})` : ''}</button><button onClick={() => navigate('/messages')}>Messages</button></div>
        <div className="nav-right"><button className="nav-invite" onClick={() => navigate('/recherche')}>Inviter</button><button onClick={() => navigate('/profil')} className="nav-username" title="Accéder au profil">{user?.nom || user?.login || 'Profil'}</button></div>
      </div>
    </nav>
  );
}
