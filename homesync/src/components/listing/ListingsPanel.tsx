import { X, MapPin, MessageSquareText } from 'lucide-react'
import { getListings } from '../../services'
import { useStore } from '../../store/store'
import ListingCard from './ListingCard'

export default function ListingsPanel() {
  const { state, dispatch } = useStore()
  if (!state.listingsOpen) return null
  const listings = state.criteria.cities.length ? state.results.included : getListings()
  return <section id="search-listings" className="listings-panel anim-slide-up" aria-label="Annonces de la recherche">
    <header className="panel-heading"><div><span className="eyebrow">VOTRE SÉLECTION</span><h2>{listings.length} logements à explorer</h2><p>Annonces fictives · {state.criteria.cities.join(', ') || 'Toute la France'}</p></div><button className="icon-button" aria-label="Fermer les annonces" onClick={() => dispatch({ type: 'SET_LISTINGS', open: false })}><X size={20} /></button></header>
    <div key={listings.map(l => l.id).join()} className="listings-grid anim-fade-in">
      {listings.map(l => <ListingCard key={l.id} listing={l} />)}
      {!listings.length && <div className="empty-panel"><MapPin size={28} /><h3>Aucun logement pour ces critères</h3><p>Modifiez votre recherche dans la conversation.</p><button className="primary-button" onClick={() => { dispatch({ type: 'SET_LISTINGS', open: false }); dispatch({ type: 'SET_TAB', tab: 'chat' }) }}><MessageSquareText size={17} /> Ouvrir le chat</button></div>}
    </div>
  </section>
}


