import { useEffect } from 'react'
import { ChevronDown, MessageSquareText, List, Maximize2 } from 'lucide-react'
import { useStore } from './store/store'
import ProfileChoice from './components/profile/ProfileChoice'
import Header from './components/layout/Header'
import MapView from './components/map/MapView'
import MapOverlay from './components/map/MapOverlay'
import ChatPanel from './components/chat/ChatPanel'
import ListingSheet from './components/listing/ListingSheet'
import CompareBar from './components/listing/CompareBar'
import CompareModal from './components/listing/CompareModal'
import FavoritesModal from './components/listing/FavoritesModal'
import InviteModal from './components/invite/InviteModal'
import MessagingModal from './components/messaging/MessagingModal'
import MobileNav from './components/layout/MobileNav'
import ListingsPanel from './components/listing/ListingsPanel'
import AnalysesView from './components/analyses/AnalysesView'

export default function App() {
  const { state, dispatch } = useStore()
  useEffect(() => {
    const viewport = window.visualViewport
    const resize = () => document.documentElement.style.setProperty('--app-height', `${viewport?.height ?? innerHeight}px`)
    resize(); viewport?.addEventListener('resize', resize)
    return () => viewport?.removeEventListener('resize', resize)
  }, [])
  if (state.stage === 'profile') return <ProfileChoice />
  return <div className="app-shell">
    <Header />
    <main className={`workspace ${state.expandedMap ? 'map-expanded' : ''}`}>
      <section className="map-panel" aria-label="Recherche sur la carte">
        <MapView /><MapOverlay /><CompareBar />
        <div className="map-toolbar">
          <button className="secondary-button" aria-label="Annonces" aria-controls="search-listings" aria-expanded={state.listingsOpen} onClick={() => dispatch({ type: 'SET_LISTINGS', open: !state.listingsOpen })}><List size={17} /> Annonces <span className="nav-count">{state.criteria.cities.length ? state.results.included.length : 'Démo'}</span></button>
          <button className="secondary-button desktop-expand" aria-label="Agrandir la carte" onClick={() => dispatch({ type: 'SET_EXPANDED', v: !state.expandedMap })}><Maximize2 size={17} /></button>
        </div>
        <ListingsPanel /><ListingSheet />
        <button className="mobile-chat-trigger primary-button" onClick={() => dispatch({ type: 'SET_TAB', tab: 'chat' })}><MessageSquareText size={18} /> Ouvrir la conversation</button>
      </section>
      <aside className={`chat-sidebar ${state.mobileTab === 'chat' ? 'is-open' : ''}`} aria-label="Conversation collaborative">
        <button className="mobile-chat-close" onClick={() => dispatch({ type: 'SET_TAB', tab: 'carte' })} aria-label="Réduire le chat"><span /><ChevronDown size={18} /></button>
        <ChatPanel />
      </aside>
      {state.view === 'analyses' && <AnalysesView />}
    </main>
    <MobileNav /><CompareModal /><FavoritesModal /><InviteModal /><MessagingModal />
  </div>
}

