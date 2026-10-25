import { useState } from 'react'
import { Heart, MessageCircle, UserPlus, ChevronDown, Building2, User, Map, ChartNoAxesCombined } from 'lucide-react'
import { useStore } from '../../store/store'
import { Logo } from '../profile/ProfileChoice'
import { AvatarStack } from '../common/Avatar'
import { getListings } from '../../services'

export default function Header() {
  const { state, dispatch } = useStore()
  const [accountOpen, setAccountOpen] = useState(false)
  const company = state.accountType === 'societe'
  const messageListingId = state.selectedId ?? state.results.included[0]?.id ?? getListings()[0]?.id
  const count = Object.values(state.favorites).filter(a => a.length).length
  return <header className="app-header">
    <Logo />
    <div className="project-name"><span className="eyebrow">PROJET ACTIF</span><span>{company ? 'Mobilité des collaborateurs' : 'Mon prochain chez-moi'}</span></div>
    <nav className="desktop-navigation" aria-label="Navigation principale">
      <button className={state.view === 'search' ? 'nav-link selected' : 'nav-link'} onClick={() => dispatch({ type: 'SET_PAGE', view: 'search' })}><Map size={17} /> Recherche</button>
      <button className="nav-link" aria-label="Favoris" onClick={() => dispatch({ type: 'SET_TAB', tab: 'favoris' })}><Heart size={17} /> Favoris {count > 0 && <span className="nav-count">{count}</span>}</button>
      <button className="nav-link" aria-label="Messages" disabled={!messageListingId} title={messageListingId ? 'Messagerie de démonstration du logement' : 'Sélectionnez un logement pour ouvrir la messagerie'} onClick={() => { if (messageListingId) dispatch({ type: 'OPEN_ADVERTISER', listingId: messageListingId }) }}><MessageCircle size={17} /> Messages</button>
      <button className={state.view === 'analyses' ? 'nav-link selected' : 'nav-link'} onClick={() => dispatch({ type: 'SET_PAGE', view: 'analyses' })}><ChartNoAxesCombined size={17} /> Analyses</button>
    </nav>
    <div className="header-people"><AvatarStack participants={state.participants} /></div>
    <button className="primary-button invite-button" aria-label="Inviter" onClick={() => dispatch({ type: 'SET_INVITE', v: true })}><UserPlus size={17} /><span>Inviter</span></button>
    <div className="relative">
      <button className="profile-button" aria-label="Profil de démonstration" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}>{company ? <Building2 size={18} /> : <User size={18} />}<span>{company ? 'Société' : 'Particulier'}</span><ChevronDown size={13} /></button>
      {accountOpen && <><button className="fixed inset-0 z-10 cursor-default" aria-label="Fermer le menu profil" onClick={() => setAccountOpen(false)} /><div className="profile-menu">
        <p className="eyebrow">PROFIL DE DÉMONSTRATION</p><h3>{company ? state.companyName : 'Compte particulier'}</h3><p>{company ? 'Recherche de logements pour vos collaborateurs.' : 'Une recherche pour vous, avec vos proches.'}</p>
        <button className="secondary-button mt-3" onClick={() => { dispatch({ type: 'CHOOSE', accountType: company ? 'particulier' : 'societe', companyName: company ? undefined : 'Movia Conseil', preserveExisting: true }); setAccountOpen(false) }}>Essayer le profil {company ? 'particulier' : 'société'}</button>
        <p className="mt-2 text-xs">Vos critères, messages et favoris sont conservés dans ce projet de démonstration.</p>
      </div></>}
    </div>
  </header>
}


