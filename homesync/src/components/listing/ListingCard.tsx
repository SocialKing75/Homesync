import { Heart, GitCompare, MapPin, Maximize } from 'lucide-react'
import type { Listing } from '../../types'
import { useStore } from '../../store/store'
import { totalCost } from '../../lib/matching'
import { TierBadge } from '../common/TierBadge'

const euro = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR')} €`)

export default function ListingCard({ listing, compact = false }: { listing: Listing; compact?: boolean }) {
  const { state, dispatch } = useStore()
  const tier = state.results.evaluations[listing.id]?.tier
  const total = totalCost(listing)
  const fav = (state.favorites[listing.id]?.length ?? 0) > 0
  const inCompare = state.compareIds.includes(listing.id)

  const highlight = () => dispatch({ type: 'HIGHLIGHT', id: listing.id, nonce: Date.now() })

  return (
    <div className={`listing-card overflow-hidden rounded-xl border border-peche-200/80 bg-white shadow-[var(--shadow-soft)] ${state.selectedId === listing.id ? 'is-selected' : ''}`}>
      <button onClick={highlight} className="relative block w-full text-left">
        <div
          className="listing-photo w-full bg-peche"
          style={{ background: `url('${listing.photos[0]}') center/cover, #edf0f2` }}
        />
        {tier && <TierBadge tier={tier} className="absolute left-2 top-2 shadow-[var(--shadow-soft)]" />}
        <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-terracotta shadow-[var(--shadow-soft)]">
          {total !== null ? `${euro(total)} CC` : `${euro(listing.rent)} + ch.`}
        </span>
      </button>

      <div className="p-3">
        <p className="listing-price">{total !== null ? euro(total) : `${euro(listing.rent)} + charges`} <span className="text-xs font-normal text-aubergine-400">/ mois</span></p>
        <p className="font-semibold text-sm text-aubergine leading-snug">{listing.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-aubergine-400">
          <span className="inline-flex items-center gap-1">
            <Maximize size={12} /> {listing.surface} m²
          </span>
          <span>{listing.rooms} pièces</span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} /> {listing.city}
          </span>
        </p>

        {!compact && listing.missingInfo.length > 0 && (
          <p className="mt-1.5 text-[11px] text-confirmer">À confirmer : {listing.missingInfo.join(', ')}</p>
        )}

        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            onClick={highlight}
            className="flex-1 rounded-lg bg-aubergine px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-aubergine-700 transition-colors"
          >
            Voir la fiche
          </button>
          <IconBtn
            active={fav}
            label="Favori"
            onClick={() => dispatch({ type: 'TOGGLE_FAV', id: listing.id, by: 'me' })}
          >
            <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
          </IconBtn>
          <IconBtn
            active={inCompare}
            label="Comparer"
            onClick={() => dispatch({ type: 'TOGGLE_COMPARE', id: listing.id })}
          >
            <GitCompare size={15} />
          </IconBtn>
        </div>
      </div>
    </div>
  )
}

function IconBtn({
  children,
  active,
  label,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
        active
          ? 'border-terracotta bg-terracotta-100 text-terracotta'
          : 'border-peche-200 text-aubergine-400 hover:border-terracotta hover:text-terracotta'
      }`}
    >
      {children}
    </button>
  )
}

