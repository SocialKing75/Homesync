import { useState } from 'react'
import { Building2, User, Send, Bot, ShieldCheck, Check, CalendarPlus, HelpCircle } from 'lucide-react'
import { useStore } from '../../store/store'
import { getListing } from '../../services'
import Modal from '../common/Modal'
import { Avatar } from '../common/Avatar'

export default function MessagingModal() {
  const { state, dispatch, sendDraft } = useStore()
  const [tab, setTab] = useState<'prive' | 'annonceur'>('annonceur')
  const [text, setText] = useState('')
  if (!state.advertiser) return null

  const listing = getListing(state.advertiser.listingId)
  if (!listing) return null
  const close = () => dispatch({ type: 'OPEN_ADVERTISER', listingId: null })

  const draftVisit = () =>
    dispatch({
      type: 'ADD_DRAFT',
      text: `Bonjour, nous sommes intéressés par « ${listing.title} ». Serait-il possible d'organiser une visite ? Nous sommes ${state.participants.length} dans le projet. Merci !`,
    })
  const draftQuestion = () =>
    dispatch({
      type: 'ADD_DRAFT',
      text: `Bonjour, le logement « ${listing.title} » est-il toujours disponible ? Les charges couvrent-elles l'eau et le chauffage ?`,
    })

  return (
    <Modal
      onClose={close}
      title="Messagerie"
      icon={listing.advertiser.type === 'agence' ? <Building2 size={18} /> : <User size={18} />}
    >
      {/* Deux conversations strictement séparées */}
      <div className="mb-3 flex gap-1 rounded-xl bg-creme-100 p-1">
        <TabBtn active={tab === 'annonceur'} onClick={() => setTab('annonceur')}>
          Avec l'annonceur
        </TabBtn>
        <TabBtn active={tab === 'prive'} onClick={() => setTab('prive')}>
          Groupe privé
        </TabBtn>
      </div>

      {/* Contexte du logement + participants */}
      <div className="flex items-center gap-2.5 rounded-xl border border-peche-200 bg-white p-2.5">
        <div
          className="h-12 w-12 shrink-0 rounded-lg bg-peche"
          style={{ background: `url('${listing.photos[0]}') center/cover, #edf0f2` }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-aubergine">{listing.title}</p>
          <p className="text-[11px] text-aubergine-400">
            {listing.advertiser.name} · {listing.advertiser.type === 'agence' ? 'Agence' : 'Propriétaire'} (annonceur)
          </p>
        </div>
        <div className="flex -space-x-2">
          {state.participants.map((p) => (
            <Avatar key={p.id} p={p} size={24} />
          ))}
        </div>
      </div>

      {tab === 'prive' ? (
        <div className="mt-3 rounded-xl bg-creme-100/60 p-4 text-center">
          <ShieldCheck size={22} className="mx-auto text-or-700" />
          <p className="mt-1.5 text-sm font-semibold text-aubergine">Votre historique privé reste privé</p>
          <p className="mt-1 text-[12.5px] text-aubergine-400">
            La conversation du groupe avec l'assistant n'est jamais partagée automatiquement avec l'annonceur. Elle se
            trouve dans le panneau de chat principal.
          </p>
        </div>
      ) : (
        <>
          {/* Fil avec l'annonceur */}
          <div className="mt-3 max-h-56 space-y-2.5 overflow-y-auto">
            {state.advertiser.messages.length === 0 && (
              <p className="py-6 text-center text-[13px] text-aubergine-400">
                Aucun message encore. L'assistant peut préparer une demande — vous validez avant tout envoi.
              </p>
            )}
            {state.advertiser.messages.map((m, i) => {
              if (m.from === 'draft') {
                return (
                  <div key={i} className="rounded-xl border-2 border-dashed border-terracotta bg-terracotta-100/40 p-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-terracotta">
                      <Bot size={12} /> Brouillon préparé — à valider
                    </p>
                    <p className="mt-1 text-[13px] text-aubergine">{m.text}</p>
                    <button
                      disabled={state.sendingDraft}
                      onClick={() => void sendDraft(i)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-aubergine-700"
                    >
                      <Check size={13} /> {state.sendingDraft ? 'Envoi simulé…' : 'Valider et envoyer'}
                    </button>
                  </div>
                )
              }
              const mine = m.from === 'me'
              return (
                <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] shadow-[var(--shadow-soft)] ${
                      mine ? 'rounded-br-md bg-aubergine text-white' : 'rounded-bl-md bg-white text-aubergine'
                    }`}
                  >
                    {!mine && (
                      <p className="mb-0.5 text-[10px] font-bold uppercase text-aubergine-400">
                        {listing.advertiser.name}
                      </p>
                    )}
                    {m.text}
                  </div>
                </div>
              )
            })}
          </div>

          {/* L'assistant prépare — l'utilisateur valide */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={draftQuestion}
              disabled={state.sendingDraft}
              className="inline-flex items-center gap-1.5 rounded-full border border-peche-200 bg-white px-3 py-1.5 text-[12px] font-medium text-aubergine hover:border-terracotta"
            >
              <HelpCircle size={13} /> Préparer une question
            </button>
            <button
              onClick={draftVisit}
              disabled={state.sendingDraft}
              className="inline-flex items-center gap-1.5 rounded-full border border-peche-200 bg-white px-3 py-1.5 text-[12px] font-medium text-aubergine hover:border-terracotta"
            >
              <CalendarPlus size={13} /> Préparer une demande de visite
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-peche-200 bg-white p-1.5">
            <input
              disabled={state.sendingDraft}
              aria-label="Message à l’annonceur (démonstration)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Écrire à l'annonceur…"
              className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-base focus:outline-none"
            />
            <button
              disabled={!text.trim() || state.sendingDraft}
              onClick={() => { dispatch({ type: 'ADD_DRAFT', text: text.trim() }); setText('') }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-aubergine text-white opacity-60"
              aria-label="Envoyer"
            >
              <Send size={16} />
            </button>
          </div>
          {state.messagingError && <p role="alert" className="mt-2 text-sm text-terracotta">{state.messagingError}</p>}
          <p className="mt-1.5 text-center text-[11px] text-aubergine-400">
            Démonstration — aucun message réel n'est envoyé à un annonceur.
          </p>
        </>
      )}
    </Modal>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        active ? 'bg-white text-aubergine shadow-[var(--shadow-soft)]' : 'text-aubergine-400'
      }`}
    >
      {children}
    </button>
  )
}


