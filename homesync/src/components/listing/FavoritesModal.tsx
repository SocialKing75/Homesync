import { Heart, GitCompare } from 'lucide-react'
import { useStore } from '../../store/store'
import { getListing } from '../../services'
import Modal from '../common/Modal'
import ListingCard from './ListingCard'
import { Avatar } from '../common/Avatar'

export default function FavoritesModal() {
  const { state, dispatch } = useStore()
  if (state.mobileTab !== 'favoris') return null
  const close = () => dispatch({ type: 'SET_TAB', tab: 'carte' })

  const favIds = Object.entries(state.favorites)
    .filter(([, who]) => who.length > 0)
    .map(([id]) => id)
  const listings = favIds.map(getListing).filter(Boolean)

  return (
    <Modal onClose={close} title="Favoris du projet" icon={<Heart size={18} />}>
      {listings.length === 0 ? (
        <div className="py-8 text-center">
          <Heart size={28} className="mx-auto text-peche-200" />
          <p className="mt-2 text-sm font-semibold text-aubergine">Aucun favori pour l'instant</p>
          <p className="mt-1 text-[13px] text-aubergine-400">
            Ajoutez des logements en favoris depuis la carte ou une fiche. Les favoris sont partagés avec le groupe.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {listings.map(
            (l) =>
              l && (
                <div key={l.id}>
                  <ListingCard listing={l} />
                  <div className="mt-1 flex items-center gap-1.5 px-1">
                    <span className="text-[11px] text-aubergine-400">Aimé par</span>
                    {(state.favorites[l.id] ?? []).map((pid) => {
                      const p = state.participants.find((x) => x.id === pid)
                      return p ? <Avatar key={pid} p={p} size={18} ring={false} /> : null
                    })}
                  </div>
                </div>
              ),
          )}
        </div>
      )}
      {listings.length >= 2 && (
        <button
          onClick={() => {
            dispatch({ type: 'OPEN_COMPARE', open: true, ids: favIds.slice(0, 3) })
            close()
          }}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-peche-200 bg-white px-3 py-2.5 text-sm font-semibold text-aubergine hover:border-terracotta"
        >
          <GitCompare size={16} /> Comparer les favoris (jusqu'à 3)
        </button>
      )}
    </Modal>
  )
}

