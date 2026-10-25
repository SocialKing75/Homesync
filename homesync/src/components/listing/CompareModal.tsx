import { GitCompare, Check, Minus, AlertCircle, Users, Wallet, CalendarCheck } from 'lucide-react'
import { useStore } from '../../store/store'
import { getListing } from '../../services'
import { totalCost } from '../../lib/matching'
import { groupFeasibility } from '../../lib/assistant'
import Modal from '../common/Modal'
import { TierBadge } from '../common/TierBadge'
import type { Listing } from '../../types'

const euro = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR')} €`)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

export default function CompareModal() {
  const { state, dispatch } = useStore()
  if (!state.compareOpen) return null
  const listings = state.compareIds.map(getListing).filter(Boolean) as Listing[]
  const close = () => dispatch({ type: 'OPEN_COMPARE', open: false })

  const feasibility = groupFeasibility(state.criteria, listings)

  return (
    <Modal onClose={close} title="Comparer les logements" icon={<GitCompare size={18} />} wide>
      {listings.length < 2 ? (
        <p className="text-sm text-aubergine-400">
          Ajoutez au moins deux logements à la comparaison (jusqu'à trois) via le bouton « Comparer » d'une fiche.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tableau comparatif défilable"><div className="grid gap-3" style={{ minWidth: 140 + listings.length * 170, gridTemplateColumns: `140px repeat(${listings.length}, minmax(170px, 1fr))` }}>
            {/* En-têtes */}
            <div />
            {listings.map((l) => {
              const ev = state.results.evaluations[l.id]
              return (
                <div key={l.id} className="rounded-xl border border-peche-200 overflow-hidden">
                  <div
                    className="h-20 w-full bg-peche"
                    style={{ background: `url('${l.photos[0]}') center/cover, #edf0f2` }}
                  />
                  <div className="p-2">
                    {ev?.tier && <TierBadge tier={ev.tier} />}
                    <p className="mt-1 text-[12.5px] font-semibold leading-tight text-aubergine">{l.title}</p>
                    <p className="text-[11px] text-aubergine-400">{l.city}</p>
                  </div>
                </div>
              )
            })}

            <Row label="Budget (CC)" icon={<Wallet size={13} />}>
              {listings.map((l) => (
                <Cell key={l.id} strong>
                  {totalCost(l) !== null ? `${euro(totalCost(l))}` : `${euro(l.rent)} + charges ?`}
                </Cell>
              ))}
            </Row>
            <Row label="Surface">
              {listings.map((l) => (
                <Cell key={l.id}>{l.surface} m²</Cell>
              ))}
            </Row>
            <Row label="Pièces / capacité" icon={<Users size={13} />}>
              {listings.map((l) => (
                <Cell key={l.id}>
                  {l.rooms} pièces · {l.capacity} pers.
                </Cell>
              ))}
            </Row>
            <Row label="Disponibilité" icon={<CalendarCheck size={13} />}>
              {listings.map((l) => (
                <Cell key={l.id}>{fmtDate(l.availableFrom)}</Cell>
              ))}
            </Row>
            <Row label="Meublé">
              {listings.map((l) => (
                <Cell key={l.id}>{l.furnished ? 'Oui' : 'Non'}</Cell>
              ))}
            </Row>
            <Row label="Trajets">
              {listings.map((l) => {
                const transit = l.equipment.find((e) => /min|tram|métro|metro|gare/i.test(e))
                return (
                  <Cell key={l.id} muted={!transit}>
                    {transit ?? 'Non renseigné'}
                  </Cell>
                )
              })}
            </Row>
            <Row label="Exigences satisfaites">
              {listings.map((l) => {
                const ev = state.results.evaluations[l.id]
                const ok = ev?.included && ev.tier !== 'confirm'
                return (
                  <Cell key={l.id}>
                    {ok ? (
                      <span className="inline-flex items-center gap-1 text-or-700">
                        <Check size={14} /> Oui
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-confirmer">
                        <Minus size={14} /> Partiel
                      </span>
                    )}
                  </Cell>
                )
              })}
            </Row>
            <Row label="Concessions / à confirmer" icon={<AlertCircle size={13} />}>
              {listings.map((l) => {
                const ev = state.results.evaluations[l.id]
                const items = [...(ev?.concession ? [ev.concession] : []), ...(ev?.missing ?? [])]
                return (
                  <Cell key={l.id} muted={items.length === 0}>
                    {items.length ? items.join(' · ') : 'Aucune'}
                  </Cell>
                )
              })}
            </Row>
          </div></div>

          {/* Faisabilité du groupe (société) */}
          {feasibility && (
            <div className="mt-4 rounded-xl border border-peche-200 bg-creme-100/60 p-3">
              <p className="text-sm font-semibold text-aubergine">Faisabilité de la combinaison</p>
              <p className="text-[12px] text-aubergine-400">{feasibility.note}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                <FeasChip ok={feasibility.capacityOk} label={`Capacité ${feasibility.capacityTotal} pers.`} />
                {feasibility.budgetOk !== null && (
                  <FeasChip
                    ok={feasibility.budgetOk}
                    label={`Budget total ${feasibility.budgetTotal ? euro(feasibility.budgetTotal) : '?'}`}
                  />
                )}
                {feasibility.datesOk !== null && <FeasChip ok={feasibility.datesOk} label="Dates compatibles" />}
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] text-aubergine-400">
            HomeSync ne calcule pas de « score de compatibilité » global : seuls des critères vérifiables sont comparés.
          </p>
        </>
      )}
    </Modal>
  )
}

function Row({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-1.5 self-center text-[12px] font-semibold text-aubergine-400">
        {icon} {label}
      </div>
      {children}
    </>
  )
}

function Cell({
  children,
  strong,
  muted,
}: {
  children: React.ReactNode
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={`self-center rounded-lg px-2 py-1.5 text-[12.5px] ${
        strong ? 'font-bold text-terracotta' : muted ? 'text-aubergine-200' : 'text-aubergine'
      }`}
    >
      {children}
    </div>
  )
}

function FeasChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
        ok ? 'bg-or-100 text-or-700' : 'bg-terracotta-100 text-terracotta'
      }`}
    >
      {ok ? <Check size={12} /> : <AlertCircle size={12} />} {label}
    </span>
  )
}


