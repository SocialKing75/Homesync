import { Map, MessageCircle, Heart, Mail, ChartNoAxesCombined } from 'lucide-react'
import { useStore } from '../../store/store'
import { getListings } from '../../services'

export default function MobileNav() {
  const { state, dispatch } = useStore()
  const favCount = Object.values(state.favorites).filter((a) => a.length > 0).length
  const best = state.selectedId ?? state.results.gold[0]?.id ?? state.results.included[0]?.id ?? getListings()[0]?.id

  const openMessages = () => {
    if (best) dispatch({ type: 'OPEN_ADVERTISER', listingId: best })
  }

  return (
    <nav className="z-30 flex items-stretch border-t border-peche-200 bg-creme/95 backdrop-blur lg:hidden">
      <Item
        active={state.mobileTab === 'carte' && state.view === 'search' && !state.advertiser}
        onClick={() => { dispatch({ type: 'SET_PAGE', view: 'search' }); dispatch({ type: 'SET_TAB', tab: 'carte' }) }}
        icon={<Map size={20} />}
        label="Carte"
      />
      <Item
        active={state.mobileTab === 'chat' && state.view === 'search' && !state.advertiser}
        onClick={() => { dispatch({ type: 'SET_PAGE', view: 'search' }); dispatch({ type: 'SET_TAB', tab: 'chat' }) }}
        icon={<MessageCircle size={20} />}
        label="Chat"
      />
      <Item
        active={state.mobileTab === 'favoris' && !state.advertiser}
        onClick={() => dispatch({ type: 'SET_TAB', tab: 'favoris' })}
        icon={<Heart size={20} />}
        label="Favoris"
        badge={favCount}
      />
      <Item disabled={!best} active={!!state.advertiser} onClick={openMessages} icon={<Mail size={20} />} label="Messages" />
      <Item active={state.view === 'analyses' && !state.advertiser} onClick={() => dispatch({ type: 'SET_PAGE', view: 'analyses' })} icon={<ChartNoAxesCombined size={20} />} label="Analyses" />
    </nav>
  )
}

function Item({
  icon,
  label,
  active,
  onClick,
  badge,
  disabled = false,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  badge?: number
  disabled?: boolean
}) {
  return (
    <button
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
        active ? 'text-terracotta' : 'text-aubergine-400'
      }`}
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-[22%] top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

