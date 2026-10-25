import { GitCompare, X } from 'lucide-react'
import { useStore } from '../../store/store'
import { getListing } from '../../services'

// Barre flottante qui apparaît dès qu'au moins un logement est en comparaison.
export default function CompareBar() {
  const { state, dispatch } = useStore()
  if (state.compareOpen || state.compareIds.length === 0) return null

  return (
    <div className="comparison-bar pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 lg:bottom-5">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-peche-200 bg-white px-2 py-2 shadow-[var(--shadow-lift)] anim-fade-up">
        <span className="pl-2 text-[12px] font-semibold text-aubergine">Comparaison</span>
        <div className="flex -space-x-2">
          {state.compareIds.map((id) => {
            const l = getListing(id)
            return (
              <div
                key={id}
                className="relative h-9 w-9 rounded-lg border-2 border-white bg-peche"
                style={{ background: `url('${l?.photos[0]}') center/cover, #edf0f2` }}
              >
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_COMPARE', id })}
                  className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-aubergine text-white"
                  aria-label="Retirer"
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>
        <button
          onClick={() => dispatch({ type: 'OPEN_COMPARE', open: true })}
          disabled={state.compareIds.length < 2}
          className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-aubergine-700 disabled:opacity-40"
        >
          <GitCompare size={15} /> Comparer ({state.compareIds.length})
        </button>
      </div>
    </div>
  )
}


