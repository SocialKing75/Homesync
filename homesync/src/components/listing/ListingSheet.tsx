import { useEffect, useState } from 'react'
import {
  X,
  Heart,
  GitCompare,
  CalendarCheck,
  MessageSquare,
  MapPin,
  Check,
  AlertCircle,
  Building2,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useStore } from '../../store/store'
import { getListing } from '../../services'
import { totalCost } from '../../lib/matching'
import { TierBadge } from '../common/TierBadge'

const euro = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR')} €`)
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const PRECISION_LABEL: Record<string, string> = {
  exacte: 'Localisation exacte',
  quartier: 'Localisation au quartier',
  approximative: 'Localisation approximative',
}

export default function ListingSheet() {
  const { state, dispatch } = useStore()
  const [photo, setPhoto] = useState(0)
  useEffect(() => { setPhoto(0) }, [state.selectedId])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dispatch({ type: 'SELECT', id: null }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])
  const listing = state.selectedId ? getListing(state.selectedId) : null
  if (!listing) return null

  const ev = state.results.evaluations[listing.id]
  const total = totalCost(listing)
  const fav = (state.favorites[listing.id]?.length ?? 0) > 0
  const inCompare = state.compareIds.includes(listing.id)
  const close = () => dispatch({ type: 'SELECT', id: null })

  return (
    <div className="absolute inset-0 z-40 flex justify-end" role="dialog" aria-label={listing.title}>
      <div className="absolute inset-0 hidden sm:block bg-aubergine/10" onClick={close} />
      <div className="listing-sheet relative anim-slide-right flex h-full flex-col bg-white shadow-[var(--shadow-lift)]">
        {/* Galerie */}
        <div className="relative shrink-0">
          <div
            role="img"
            aria-label={`Illustration du logement, photo ${photo + 1}`}
            className="listing-gallery w-full bg-peche"
            style={{ background: `url('${listing.photos[photo]}') center/cover, #edf0f2` }}
          />
          <button aria-label="Photo précédente" className="gallery-arrow icon-button left-3" onClick={() => setPhoto((photo - 1 + listing.photos.length) % listing.photos.length)}><ChevronLeft size={19} /></button>
          <button aria-label="Photo suivante" className="gallery-arrow icon-button right-3" onClick={() => setPhoto((photo + 1) % listing.photos.length)}><ChevronRight size={19} /></button>
          <button
            onClick={close}
            aria-label="Fermer"
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-aubergine shadow-[var(--shadow-soft)] hover:bg-white"
          >
            <X size={18} />
          </button>
          {ev?.tier && <TierBadge tier={ev.tier} className="absolute left-3 top-3 shadow-[var(--shadow-soft)]" />}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {listing.photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhoto(i)}
                aria-label={`Photo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === photo ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
          <span className="absolute bottom-3 right-3 rounded-full bg-aubergine/80 px-2 py-0.5 text-[10px] font-medium text-white">
            Photos de démonstration
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <span className="eyebrow">VOTRE PROCHAIN LIEU DE VIE · DÉMONSTRATION</span>
          <h2 className="mt-2 font-display text-3xl font-semibold text-aubergine">{listing.title}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-aubergine-400">
            <MapPin size={14} /> {listing.city} · {PRECISION_LABEL[listing.locationPrecision]}
          </p>

          {/* Prix */}
          <div className="mt-3 flex items-end gap-3 rounded-xl bg-creme-100/70 px-3.5 py-3">
            <div>
              <p className="text-2xl font-bold text-terracotta">{euro(listing.rent)}</p>
              <p className="text-[11px] text-aubergine-400">Loyer hors charges / mois</p>
            </div>
            <div className="border-l border-peche-200 pl-3">
              <p className="text-base font-semibold text-aubergine">
                {listing.charges === null ? 'À confirmer' : euro(listing.charges)}
              </p>
              <p className="text-[11px] text-aubergine-400">Charges</p>
            </div>
            {total !== null && (
              <div className="ml-auto text-right">
                <p className="text-base font-semibold text-aubergine">{euro(total)}</p>
                <p className="text-[11px] text-aubergine-400">Total CC</p>
              </div>
            )}
          </div>

          {/* Caractéristiques */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Spec value={`${listing.surface} m²`} label="Surface" />
            <Spec value={`${listing.rooms} pièces`} label="Type" />
            <Spec value={`${listing.capacity} pers.`} label="Capacité" />
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-sm text-aubergine">
            <CalendarCheck size={15} className="text-terracotta" /> Disponible le {fmtDate(listing.availableFrom)}
            {listing.furnished && <span className="ml-1 rounded-full bg-peche/60 px-2 py-0.5 text-[11px]">Meublé</span>}
          </p>

          <section className="mt-5"><h3 className="font-display text-xl font-semibold">Le logement en quelques mots</h3><p className="listing-description mt-2">À {listing.city}, ce logement de démonstration propose {listing.rooms} pièces sur {listing.surface} m², pour une capacité annoncée de {listing.capacity} personnes. Il est {listing.furnished ? 'meublé' : 'non meublé'}. Les photos sont des illustrations et la localisation est {listing.locationPrecision === 'exacte' ? 'fictive et indicative' : 'indiquée au quartier ou approximativement'}.</p><p className="listing-description mt-2">Conditions de location, durée du bail et disponibilité définitive : À confirmer auprès de l’annonceur.</p></section>

          {/* Correspondance avec le projet */}
          {ev && (
            <section className="mt-4 rounded-xl border border-peche-200 p-3">
              <p className="text-sm font-semibold text-aubergine">Correspondance avec votre projet</p>
              <ul className="mt-2 space-y-1.5">
                {ev.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-aubergine-400">
                    <Check size={14} className="mt-0.5 shrink-0 text-or-700" /> {r}
                  </li>
                ))}
              </ul>
              {ev.missing.length > 0 && (
                <div className="mt-2 rounded-lg bg-creme-100 px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-confirmer">
                    <AlertCircle size={13} /> Informations à confirmer
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-[12px] text-aubergine-400">
                    {ev.missing.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Équipements */}
          <section className="mt-4">
            <p className="text-sm font-semibold text-aubergine">Équipements renseignés</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {listing.equipment.map((e) => (
                <span key={e} className="rounded-full bg-peche/50 px-2.5 py-1 text-[12px] text-aubergine">
                  {e}
                </span>
              ))}
            </div>
            {listing.missingInfo.length > 0 && (
              <p className="mt-2 text-[12px] text-confirmer">
                Informations manquantes : {listing.missingInfo.join(', ')}.
              </p>
            )}
          </section>

          {/* Annonceur */}
          <section className="mt-4 flex items-center gap-2.5 rounded-xl bg-creme-100/70 px-3 py-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-aubergine text-white">
              {listing.advertiser.type === 'agence' ? <Building2 size={16} /> : <User size={16} />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-aubergine">{listing.advertiser.name}</p>
              <p className="text-[11px] text-aubergine-400">
                {listing.advertiser.type === 'agence' ? 'Agence' : 'Propriétaire'} · rôle : annonceur
              </p>
            </div>
          </section>
        </div>

        {/* Actions */}
        <div className="listing-sheet-footer">
          <div className="flex items-center gap-2">
            <button
              onClick={() => dispatch({ type: 'TOGGLE_FAV', id: listing.id, by: 'me' })}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                fav ? 'border-terracotta bg-terracotta-100 text-terracotta' : 'border-peche-200 text-aubergine hover:border-terracotta'
              }`}
            >
              <Heart size={16} fill={fav ? 'currentColor' : 'none'} /> Favori
            </button>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_COMPARE', id: listing.id })}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                inCompare ? 'border-terracotta bg-terracotta-100 text-terracotta' : 'border-peche-200 text-aubergine hover:border-terracotta'
              }`}
            >
              <GitCompare size={16} /> Comparer
            </button>
          </div>
          <div className="sheet-actions"><button className="secondary-button" onClick={() => dispatch({ type: 'OPEN_ADVERTISER', listingId: listing.id })}><MessageSquare size={16} /> Poser une question</button><button className="primary-button" onClick={() => { dispatch({ type: 'OPEN_ADVERTISER', listingId: listing.id }); dispatch({ type: 'ADD_DRAFT', text: `Bonjour, je souhaite organiser une visite pour « ${listing.title} ». Quelles sont vos disponibilités ?` }) }}><CalendarCheck size={16} /> Demander une visite</button></div>
          <p className="mt-1.5 text-center text-[11px] text-aubergine-400">
            Démonstration — aucun message réel n'est envoyé.
          </p>
        </div>
      </div>
    </div>
  )
}

function Spec({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-peche-200 py-2">
      <p className="text-sm font-semibold text-aubergine">{value}</p>
      <p className="text-[11px] text-aubergine-400">{label}</p>
    </div>
  )
}


