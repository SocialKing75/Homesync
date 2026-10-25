import { useEffect, useRef, useState } from 'react'
import { Send, MicOff, Sparkles, Bot, RefreshCw, Map } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Message, Participant } from '../../types'
import { Avatar } from '../common/Avatar'
import ListingCard from '../listing/ListingCard'
import CriteriaRecap from './CriteriaRecap'
import WhatIfBanner from './WhatIfBanner'
import { getListing } from '../../services'
import { SCENARIOS } from '../../data/scenarios'

export default function ChatPanel() {
  const { state, send, dispatch } = useStore()
  const [scenario, setScenario] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const [text, setText] = useState('')
  const [sender, setSender] = useState('me')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [state.messages, state.typing])

  const submit = () => {
    if (!text.trim() || state.typing) return
    send(text, sender)
    setText('')
  }

  const lastAi = [...state.messages].reverse().find((m) => m.sender === 'ai') as
    | (Message & { suggestions?: string[] })
    | undefined
  const suggestions = lastAi?.suggestions ?? []

  const participantById = (id: string) => state.participants.find((p) => p.id === id)

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* En-tête du chat */}
      <div className="chat-heading flex shrink-0 items-center gap-2 border-b border-peche-200/70 px-5 py-4">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-aubergine text-white">
          <Bot size={17} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold text-aubergine">Cherchons ensemble</p>
          <span className="demo-badge">Mode démonstration</span>
          <p className="truncate text-[11px] text-aubergine-400">
            Conversation privée du groupe · {state.participants.length} participant
            {state.participants.length > 1 ? 's' : ''}
          </p>
          {state.accountType === 'societe' && <p className="text-[11px] text-aubergine-400">{state.criteria.units ? `${state.criteria.units} logements` : 'Logements à préciser'} · {state.criteria.people ? `${state.criteria.people} personnes` : 'Effectif à préciser'}{state.criteria.durationMonths ? ` · ${state.criteria.durationMonths} mois` : ''}</p>}
        </div>
        <div className="ml-auto flex -space-x-2">
          {state.participants.map((p) => (
            <Avatar key={p.id} p={p} size={26} />
          ))}
        </div>
      </div>

      <CriteriaRecap />
      <details className="scenario-tools border-b border-peche-200 px-4 py-2 text-xs text-aubergine-400">
        <summary className="cursor-pointer font-semibold">Démonstration · 3 conversations simulées</summary>
        <p className="py-2">Analyse locale par mots-clés, sans OpenAI. Chaque parcours repart de zéro.</p>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((item, index) => <button key={item.name} disabled={state.typing} className="rounded-lg border border-peche-200 bg-white px-2 py-2 disabled:opacity-40" onClick={() => {
            dispatch({ type: 'CHOOSE', accountType: item.profile, companyName: item.profile === 'societe' ? 'Movia Conseil' : undefined })
            setScenario(index); setStep(0)
          }}>{item.name}</button>)}
        </div>
        {scenario !== null && <div className="pt-2"><p>{SCENARIOS[scenario].messages[step] ?? 'Parcours terminé : explorez les résultats sur la carte.'}</p>{step < SCENARIOS[scenario].messages.length && <button disabled={state.typing} className="mt-2 rounded-lg bg-aubergine px-3 py-2 text-white disabled:opacity-40" onClick={() => { send(SCENARIOS[scenario].messages[step], 'me'); setStep(step + 1) }}>Simuler l’étape {step + 1}/3</button>}</div>}
      </details>

      {/* Fil de messages */}
      <div ref={scrollRef} role="log" aria-label="Messages du projet" aria-live="polite" className="chat-messages min-h-0 flex-1 space-y-5 overflow-y-auto bg-creme/40 px-4 py-5">
        {state.messages.map((m) => (
          <Bubble key={m.id} msg={m} participant={m.sender === 'ai' ? undefined : participantById(m.sender)} />
        ))}

        {state.whatIf && <WhatIfBanner />}

        {state.typing && (
          <div className="flex items-end gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-aubergine text-white">
              <Bot size={15} />
            </span>
            <div className="rounded-2xl rounded-bl-md bg-white px-3 py-2.5 shadow-[var(--shadow-soft)]">
              <span className="flex items-center gap-2 text-[12px] text-aubergine-400">
                <RefreshCw size={12} className="animate-spin" /> Mise à jour de votre recherche…
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions contextuelles */}
      {suggestions.length > 0 && !state.typing && (
        <div className="chat-suggestions flex shrink-0 gap-2 overflow-x-auto px-4 py-2">
          {suggestions.map((s) => (
            <button
              key={s}
              disabled={state.typing}
              onClick={() => send(s, sender)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-peche-200 bg-white px-3 py-1.5 text-[12px] font-medium text-aubergine hover:border-terracotta hover:text-terracotta transition-colors"
            >
              <Sparkles size={12} className="text-or-700" /> {s}
            </button>
          ))}
        </div>
      )}

      {/* Saisie */}
      <div className="chat-input-wrap border-t border-peche-200/70 px-3 pb-3 pt-2.5">
        {state.serviceError && <p role="alert" className="mb-2 text-sm text-terracotta">{state.serviceError}</p>}
        {state.participants.length > 1 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-aubergine-400">Écrire en tant que :</span>
            {state.participants.map((p) => (
              <button
                key={p.id}
                onClick={() => setSender(p.id)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  sender === p.id ? 'bg-aubergine text-white' : 'bg-white text-aubergine-400 border border-peche-200'
                }`}
              >
                <Avatar p={p} size={16} ring={false} /> {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-peche-200 bg-white p-1.5 focus-within:border-terracotta transition-colors">
          <textarea
            aria-label="Votre recherche de logement"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder="Décrivez votre besoin… ex. « un T3 à Nantes, max 1 200 € CC »"
            className="max-h-28 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-aubergine placeholder:text-aubergine-200 focus:outline-none"
          />
          <button
            disabled
            aria-label="Microphone indisponible en démonstration"
            title="Microphone indisponible en démonstration"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-aubergine-400 opacity-50"
          >
            <MicOff size={18} />
          </button>
          <button
            onClick={submit}
            disabled={!text.trim() || state.typing}
            aria-label="Envoyer"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aubergine text-white transition-colors hover:bg-aubergine-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Bubble({ msg, participant }: { msg: Message & { suggestions?: string[] }; participant?: Participant }) {
  const isAi = msg.sender === 'ai'
  const isMe = msg.sender === 'me'

  if (isMe) {
    return (
      <div className="flex justify-end anim-fade-up">
        <div className="chat-user-message max-w-[88%] rounded-2xl rounded-br-md px-4 py-3 text-sm text-white shadow-[var(--shadow-soft)]">
          <p className="mb-1 text-xs font-semibold">{participant?.name ?? 'Vous'}</p>
          {msg.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 anim-fade-up">
      {isAi ? (
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aubergine text-white">
          <Bot size={15} />
        </span>
      ) : (
        participant && <div className="mt-0.5">{<Avatar p={participant} size={28} />}</div>
      )}
      <div className="min-w-0 max-w-[85%]">
        {!isAi && participant && (
          <p className="mb-0.5 text-[11px] font-semibold text-aubergine-400">{participant.name}</p>
        )}
        <div
          className={`rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm shadow-[var(--shadow-soft)] ${
            isAi ? 'bg-white text-aubergine ring-1 ring-peche-200/60' : 'bg-white text-aubergine'
          }`}
        >
          {isAi && (
            <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-terracotta">
              <Bot size={11} /> Assistant
            </span>
          )}
          <p className="leading-relaxed">{msg.text}</p>
          {msg.change && (
            <p className="mt-1.5 rounded-lg bg-creme-100 px-2 py-1 text-[12px] text-aubergine-400">↻ {msg.change}</p>
          )}
        </div>

        {/* Cartes de logements intégrées */}
        {msg.cards?.map((card, i) => {
          if (card.kind === 'cities') {
            return (
              <div
                key={i}
                className="mt-2 rounded-xl border border-peche-200 bg-white px-3 py-2 text-[12px] font-medium text-aubergine shadow-[var(--shadow-soft)]"
              >
                <Map size={14} className="mr-1 inline" /> {card.note}
              </div>
            )
          }
          const listings = (card.listingIds ?? []).map(getListing).filter(Boolean)
          return (
            <div key={i} className="mt-2 grid gap-2">
              {listings.map((l) => l && <ListingCard key={l.id} listing={l} compact />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

