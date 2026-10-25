import { useState } from 'react'
import { Globe2, ChevronDown, Info, Navigation, Loader2, SearchX, Building2 } from 'lucide-react'
import { useStore } from '../../store/store'
import { SHORTCUTS, FRANCE_CENTER, FRANCE_ZOOM } from '../../data/cities'

// Couches d'interface posées au-dessus de la carte : raccourcis de vue,
// légende, badge de démonstration et états.
export default function MapOverlay() {
  const { state, dispatch } = useStore()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [noData, setNoData] = useState<string | null>(null)

  const goFrance = () => {
    setNoData(null)
    dispatch({ type: 'SET_VIEW', center: [FRANCE_CENTER[1], FRANCE_CENTER[0]], zoom: FRANCE_ZOOM })
  }

  return (
    <>
      {/* Badge démonstration */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-aubergine/85 px-3 py-1.5 text-[11px] font-medium text-white shadow-[var(--shadow-soft)]">
        <Info size={13} /> Annonces fictives
      </div>

      {/* Vue France + raccourcis */}
      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
        <button
          onClick={goFrance}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold text-aubergine shadow-[var(--shadow-soft)] hover:text-terracotta transition-colors"
        >
          <Globe2 size={16} /> Vue France
        </button>
        <div className="relative">
          <button
            onClick={() => setShortcutsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[13px] font-medium text-aubergine shadow-[var(--shadow-soft)] hover:text-terracotta transition-colors"
          >
            <Navigation size={14} /> Territoires <ChevronDown size={14} />
          </button>
          {shortcutsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShortcutsOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-peche-200 bg-white p-1.5 shadow-[var(--shadow-lift)] anim-fade-up">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-aubergine-400">
                  Raccourcis de vue
                </p>
                {SHORTCUTS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => {
                      dispatch({ type: 'SET_VIEW', center: [s.center[1], s.center[0]], zoom: s.zoom })
                      setShortcutsOpen(false)
                      setNoData(s.noData ? s.label : null)
                      if (!s.noData) setNoData(null)
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-aubergine hover:bg-creme-100"
                  >
                    {s.label}
                    {s.noData && (
                      <span className="rounded-full bg-creme-100 px-1.5 py-0.5 text-[10px] text-aubergine-400">
                        aucune donnée
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Légende compacte — libellés indépendants de la couleur */}
      <div className="map-legend absolute bottom-8 left-3 z-20 rounded-xl border border-peche-200 bg-white/95 px-3 py-2.5 shadow-[var(--shadow-soft)]">
        <details><summary className="cursor-pointer text-xs font-semibold text-aubergine">Pourquoi ces zones ?</summary><p className="max-w-64 py-2 text-xs text-aubergine-400">Gold : exigences respectées, budget au plus à 90 % du plafond et préférences satisfaites. Argent : exigences respectées avec budget proche du plafond ou préférence non satisfaite. Informations essentielles manquantes : À confirmer. Rayons de 1,15 km autour des annonces ; aucun calcul de trajet.</p></details>
        <p className="mb-1.5 text-[11px] font-semibold text-aubergine">Légende</p>
        <ul className="space-y-1 text-[11.5px] text-aubergine-400">
          <LegendItem color="#B88A24" label="Zone « Meilleur accord » (Gold)" />
          <LegendItem color="#5f7085" label="Zone « Compromis possible » (Argent)" />
          <LegendItem color="var(--navy)" label="Repère de prix (annonce)" pill />
          <LegendItem color="var(--copper-dark)" label="Sélection : marine, contour cuivre" pill />
        </ul>
      </div>

      {/* Territoire sans données */}
      {noData && (
        <StateCard icon={<Building2 size={20} />} title={`Aucune annonce de démonstration — ${noData}`}>
          Nous ne prétendons pas couvrir ce territoire : aucune donnée fictive n'y est disponible pour l'instant.
          <button onClick={goFrance} className="mt-2 block font-semibold text-terracotta">
            Revenir à la vue France
          </button>
        </StateCard>
      )}

      {/* États métiers */}
      {state.appState === 'updating' && (
        <StatePill icon={<Loader2 size={14} className="animate-spin" />}>Mise à jour de la carte…</StatePill>
      )}
      {state.appState === 'empty' && !noData && (
        <StateCard icon={<SearchX size={20} />} title="Aucun résultat pour ces critères">
          Je n'ai pas d'annonce de démonstration correspondant exactement. Assouplissez une exigence dans le chat,
          ou tentez une hypothèse « Et si… ? ».
        </StateCard>
      )}
      {state.appState === 'error' && (
        <StateCard icon={<Info size={20} />} title="Une erreur est survenue">
          Impossible de mettre à jour la recherche pour le moment. Réessayez dans un instant.
        </StateCard>
      )}
    </>
  )
}

function LegendItem({ color, label, pill }: { color: string; label: string; pill?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={pill ? 'h-3 w-5 rounded-full' : 'h-3 w-3 rounded-sm'}
        style={{ background: color, opacity: pill ? 1 : 0.5, border: pill ? 'none' : `1.5px dashed ${color}` }}
      />
      {label}
    </li>
  )
}

function StatePill({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="absolute left-3 top-24 sm:left-1/2 sm:top-3 z-20 flex sm:-translate-x-1/2 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-aubergine shadow-[var(--shadow-lift)] anim-fade-up">
      {icon} {children}
    </div>
  )
}

function StateCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="absolute left-1/2 top-1/2 z-20 w-[min(90%,340px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-peche-200 bg-white p-4 text-center shadow-[var(--shadow-lift)] anim-fade-up">
      <span className="mx-auto mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-peche/60 text-aubergine">
        {icon}
      </span>
      <p className="font-display text-base font-semibold text-aubergine">{title}</p>
      <div className="mt-1 text-[13px] text-aubergine-400">{children}</div>
    </div>
  )
}
