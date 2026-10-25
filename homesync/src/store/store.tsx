import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import type { AccountType, AdvertiserThread, AppState, Criteria, Message, Participant, WhatIf } from '../types'
import { applyPatch, emptyCriteria } from '../lib/nlu'
import type { Results } from '../lib/assistant'
import { dataServices } from '../services'
import { CITIES } from '../data/cities'

const computeResults = dataServices.search.evaluate
const whatIfPreview = dataServices.search.preview
export type { AdvertiserThread } from '../types'

export type MapCmd =
  | { kind: 'view'; center: [number, number]; zoom: number; nonce: number }
  | { kind: 'cities'; cities: string[]; nonce: number; requestedAt?: number }
  | { kind: 'highlight'; listingId: string; nonce: number }

interface State {
  catalogRevision: number
  serviceError: string | null
  threads: Record<string, AdvertiserThread>
  sendingDraft: boolean
  messagingError: string | null
  stage: 'profile' | 'app'
  view: 'search' | 'analyses'
  listingsOpen: boolean
  accountType: AccountType | null
  companyName: string | null
  participants: Participant[]
  criteria: Criteria
  messages: Message[]
  appState: AppState
  results: Results
  selectedId: string | null
  favorites: Record<string, string[]> // listingId -> participantIds qui l'ont aimé
  compareIds: string[]
  compareOpen: boolean
  whatIf: WhatIf | null
  typing: boolean
  pendingInvites: { name: string; role: string }[]
  mapCmd: MapCmd | null
  expandedMap: boolean
  advertiser: AdvertiserThread | null
  inviteOpen: boolean
  mobileTab: 'carte' | 'chat' | 'favoris' | 'messages'
}

type Action =
  | { type: 'CATALOG_READY' }
  | { type: 'SERVICE_ERROR'; message: string }
  | { type: 'SET_THREAD'; thread: AdvertiserThread }
  | { type: 'SET_SENDING'; sending: boolean; error?: string | null }
  | { type: 'SET_PAGE'; view: State['view'] }
  | { type: 'SET_LISTINGS'; open: boolean }
  | { type: 'CHOOSE'; accountType: AccountType; companyName?: string; preserveExisting?: boolean }
  | { type: 'ADD_USER_MSG'; msg: Message }
  | { type: 'SET_UPDATING' }
  | {
      type: 'RESOLVE'
      criteria: Criteria
      results: Results
      msg: Message
      appState: AppState
      mapCmd: MapCmd | null
    }
  | { type: 'RESOLVE_WHATIF'; whatIf: WhatIf; msg: Message }
  | { type: 'APPLY_WHATIF'; criteria: Criteria; results: Results; msg: Message }
  | { type: 'DISMISS_WHATIF'; msg: Message }
  | { type: 'SELECT'; id: string | null }
  | { type: 'HIGHLIGHT'; id: string; nonce: number }
  | { type: 'TOGGLE_FAV'; id: string; by: string }
  | { type: 'TOGGLE_COMPARE'; id: string }
  | { type: 'OPEN_COMPARE'; open: boolean; ids?: string[] }
  | { type: 'ADD_PARTICIPANT'; p: Participant; msg: Message }
  | { type: 'ADD_PLACE'; id: string; place: Participant['place']; msg?: Message }
  | { type: 'SET_VIEW'; center: [number, number]; zoom: number }
  | { type: 'SET_EXPANDED'; v: boolean }
  | { type: 'SET_INVITE'; v: boolean }
  | { type: 'OPEN_ADVERTISER'; listingId: string | null }
  | { type: 'ADD_DRAFT'; text: string }
  | { type: 'SET_TAB'; tab: State['mobileTab'] }

let nonceSeq = 1
const nextNonce = () => nonceSeq++
let msgSeq = 1
export const newId = (p = 'm') => `${p}${msgSeq++}-${Date.now().toString(36)}`

const PALETTE = ['var(--navy)', 'var(--copper-dark)', 'var(--color-argent-700)', 'var(--text-muted)']

function initialParticipants(type: AccountType): Participant[] {
  if (type === 'societe') {
    return [
      { id: 'me', name: 'Camille (RH Mobilité)', initials: 'CA', color: PALETTE[0], role: 'demandeur' },
    ]
  }
  return [{ id: 'me', name: 'Vous', initials: 'VO', color: PALETTE[0], role: 'demandeur' }]
}

function welcome(type: AccountType): Message {
  const text =
    type === 'societe'
      ? "Bienvenue sur HomeSync. Décrivez votre besoin : nombre de logements, personnes à loger, ville, dates et budget. Par exemple : « Nous cherchons trois logements meublés à Lille pour six collaborateurs pendant quatre mois. »"
      : "Bonjour ! Votre prochain lieu de vie commence par une conversation. Dites-moi ce que vous cherchez — par exemple : « On cherche un T3 à Nantes, maximum 1 200 € charges comprises. »"
  return { id: newId('ai'), sender: 'ai', text, ts: Date.now() }
}

function initialState(): State {
  return {
    catalogRevision: 0,
    serviceError: null,
    threads: {},
    sendingDraft: false,
    messagingError: null,
    stage: 'profile',
    view: 'search',
    listingsOpen: false,
    accountType: null,
    companyName: null,
    participants: [],
    criteria: emptyCriteria(false),
    messages: [],
    appState: 'idle',
    results: computeResults(emptyCriteria(false)),
    selectedId: null,
    favorites: {},
    compareIds: [],
    compareOpen: false,
    whatIf: null,
    typing: false,
    pendingInvites: [],
    mapCmd: null,
    expandedMap: false,
    advertiser: null,
    inviteOpen: false,
    mobileTab: 'carte',
  }
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'CATALOG_READY': return { ...s, catalogRevision: s.catalogRevision + 1, results: computeResults(s.criteria) }
    case 'SERVICE_ERROR': return { ...s, serviceError: a.message, typing: false, appState: 'error' }
    case 'SET_SENDING': return { ...s, sendingDraft: a.sending, messagingError: a.error ?? null }
    case 'SET_THREAD': return { ...s, threads: { ...s.threads, [a.thread.listingId]: a.thread }, advertiser: s.advertiser?.listingId === a.thread.listingId ? a.thread : s.advertiser }
    case 'SET_PAGE': return { ...s, view: a.view }
    case 'SET_LISTINGS': return { ...s, selectedId: null, listingsOpen: a.open, mobileTab: 'carte', view: 'search' }
    case 'CHOOSE': {
      // Le choix initial peut reprendre un projet sans effacer ses saisies.
      // Les scénarios de démonstration gardent leur réinitialisation explicite.
      if (a.preserveExisting && s.accountType !== null) {
        const criteria = applyPatch(s.criteria, { isCompany: a.accountType === 'societe' })
        return { ...s, stage: 'app', accountType: a.accountType, companyName: a.companyName ?? s.companyName, criteria, results: computeResults(criteria), typing: false, sendingDraft: false, serviceError: null, messagingError: null, appState: !criteria.cities.length ? 'idle' : computeResults(criteria).included.length ? 'results' : 'empty' }
      }
      const crit = emptyCriteria(a.accountType === 'societe')
      return {
        ...initialState(),
        stage: 'app',
        accountType: a.accountType,
        companyName: a.companyName ?? null,
        participants: initialParticipants(a.accountType),
        criteria: crit,
        results: computeResults(crit),
        messages: [welcome(a.accountType)],
      }
    }
    case 'ADD_USER_MSG':
      return { ...s, messages: [...s.messages, a.msg] }
    case 'SET_UPDATING':
      return { ...s, appState: 'updating', typing: true, serviceError: null }
    case 'RESOLVE':
      return {
        ...s,
        selectedId: null,
        whatIf: null,
        criteria: a.criteria,
        results: a.results,
        appState: a.appState,
        typing: false,
        messages: [...s.messages, a.msg],
        mapCmd: a.mapCmd,
      }
    case 'RESOLVE_WHATIF':
      return { ...s, appState: !s.criteria.cities.length ? 'idle' : s.results.included.length ? 'results' : 'empty', typing: false, whatIf: a.whatIf, messages: [...s.messages, a.msg] }
    case 'APPLY_WHATIF':
      return {
        ...s,
        whatIf: null,
        criteria: a.criteria,
        results: a.results,
        appState: !a.criteria.cities.length ? 'idle' : a.results.included.length ? 'results' : 'empty',
        messages: [...s.messages, a.msg],
      }
    case 'DISMISS_WHATIF':
      return { ...s, whatIf: null, messages: [...s.messages, a.msg] }
    case 'SELECT':
      return { ...s, selectedId: a.id }
    case 'HIGHLIGHT':
      return { ...s, view: 'search', listingsOpen: false, mobileTab: 'carte', compareOpen: false, selectedId: a.id, mapCmd: { kind: 'highlight', listingId: a.id, nonce: a.nonce } }
    case 'TOGGLE_FAV': {
      const cur = s.favorites[a.id] ?? []
      const next = cur.includes(a.by) ? cur.filter((x) => x !== a.by) : [...cur, a.by]
      return { ...s, favorites: { ...s.favorites, [a.id]: next } }
    }
    case 'TOGGLE_COMPARE': {
      const has = s.compareIds.includes(a.id)
      let ids = has ? s.compareIds.filter((x) => x !== a.id) : [...s.compareIds, a.id]
      if (ids.length > 3) ids = ids.slice(-3)
      return { ...s, compareIds: ids }
    }
    case 'OPEN_COMPARE':
      return { ...s, compareOpen: a.open, compareIds: a.ids ?? s.compareIds }
    case 'ADD_PARTICIPANT':
      return {
        ...s,
        participants: [...s.participants, a.p],
        inviteOpen: false,
        messages: [...s.messages, a.msg],
      }
    case 'ADD_PLACE':
      return {
        ...s,
        participants: s.participants.map((p) => (p.id === a.id ? { ...p, place: a.place } : p)),
        messages: a.msg ? [...s.messages, a.msg] : s.messages,
      }
    case 'SET_VIEW':
      return { ...s, mapCmd: { kind: 'view', center: a.center, zoom: a.zoom, nonce: nextNonce() } }
    case 'SET_EXPANDED':
      return { ...s, expandedMap: a.v }
    case 'SET_INVITE':
      return { ...s, inviteOpen: a.v }
    case 'OPEN_ADVERTISER':
      return {
        ...s,
        advertiser: a.listingId ? s.threads[a.listingId] ?? { listingId: a.listingId, messages: [] } : null,
        messagingError: null,
      }
    case 'ADD_DRAFT': {
      if (!s.advertiser) return s
      const thread: AdvertiserThread = { ...s.advertiser, messages: [...s.advertiser.messages, { from: 'draft', text: a.text }] }
      return { ...s, advertiser: thread, threads: { ...s.threads, [thread.listingId]: thread } }
    }
    case 'SET_TAB':
      return { ...s, view: 'search', mobileTab: a.tab, listingsOpen: false, selectedId: null }
    default:
      return s
  }
}

interface Ctx {
  state: State
  dispatch: React.Dispatch<Action>
  send: (text: string, senderId: string) => void
  applyWhatIf: () => void
  dismissWhatIf: () => void
  sendDraft: (index: number) => Promise<void>
  flyToCities: (cities: string[]) => void
}

const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, initialState)
  const pendingSearch = useRef<AbortController | null>(null)
  const pendingMessage = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const dispatch = useCallback<React.Dispatch<Action>>((action) => {
    if (action.type === 'CHOOSE') {
      generation.current++
      pendingSearch.current?.abort()
      pendingMessage.current?.abort()
    }
    rawDispatch(action)
  }, [])
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const controller = new AbortController()
    dataServices.catalog.list(controller.signal).then(() => dispatch({ type: 'CATALOG_READY' })).catch(error => {
      if (error?.name !== 'AbortError') dispatch({ type: 'SERVICE_ERROR', message: 'Impossible de charger les logements. Réessayez plus tard.' })
    })
    return () => { controller.abort(); pendingSearch.current?.abort(); pendingMessage.current?.abort(); generation.current++ }
  }, [dispatch])

  function send(text: string, senderId: string) {
    const requestedAt = Date.now()
    const trimmed = text.trim()
    if (!trimmed) return
    const cur = stateRef.current
    const turn = ++generation.current
    pendingSearch.current?.abort()
    const controller = new AbortController()
    pendingSearch.current = controller
    const userMessage: Message = { id: newId(), sender: senderId, text: trimmed, ts: requestedAt }
    dispatch({ type: 'ADD_USER_MSG', msg: userMessage })
    dispatch({ type: 'SET_UPDATING' })

    void dataServices.search.reply({ text: trimmed, senderId, criteria: cur.criteria, history: [...cur.messages, userMessage] }, controller.signal).then(response => {
      if (controller.signal.aborted || turn !== generation.current) return
      if (response.kind === 'preview') {
        dispatch({
          type: 'RESOLVE_WHATIF',
          whatIf: response.preview,
          msg: { id: newId('ai'), sender: 'ai', text: `Aperçu de l'hypothèse — ${response.preview.summary} Rien n'est modifié tant que vous n'avez pas confirmé.`, ts: Date.now() },
        })
        return
      }
      const { criteria, results, reply, compareCities } = response
      let mapCmd: MapCmd | null = null
      if (compareCities && compareCities.length >= 2) {
        mapCmd = { kind: 'cities', cities: compareCities, nonce: nextNonce(), requestedAt }
      } else if (criteria.cities.length && criteria.cities.join() !== cur.criteria.cities.join()) {
        mapCmd = { kind: 'cities', cities: criteria.cities, nonce: nextNonce(), requestedAt }
      }
      const msg: Message & { suggestions?: string[] } = {
        id: newId('ai'), sender: 'ai', text: reply.text, change: reply.change, cards: reply.cards, suggestions: reply.suggestions, ts: Date.now(),
      }
      dispatch({ type: 'RESOLVE', criteria, results, msg, appState: !criteria.cities.length ? 'idle' : results.included.length ? 'results' : 'empty', mapCmd })
    }).catch(error => {
      if (error?.name !== 'AbortError' && turn === generation.current) {
        dispatch({ type: 'SERVICE_ERROR', message: 'La recherche n’a pas pu être mise à jour. Vos critères et favoris sont conservés. Réessayez votre message.' })
      }
    })
  }

  async function sendDraft(index: number) {
    const current = stateRef.current
    if (!current.advertiser || current.sendingDraft || pendingMessage.current) return
    const controller = new AbortController()
    pendingMessage.current = controller
    dispatch({ type: 'SET_SENDING', sending: true })
    try {
      const thread = await dataServices.messaging.send(current.advertiser, index, controller.signal)
      if (!controller.signal.aborted) {
        dispatch({ type: 'SET_THREAD', thread })
        dispatch({ type: 'SET_SENDING', sending: false })
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({ type: 'SET_SENDING', sending: false, error: 'Le message n’a pas pu être envoyé. Le brouillon est conservé ; réessayez.' })
      }
    } finally {
      if (pendingMessage.current === controller) pendingMessage.current = null
    }
  }

  function applyWhatIf() {
    const cur = stateRef.current
    if (!cur.whatIf) return
    const prev = whatIfPreview(cur.criteria, cur.whatIf.question)
    const results = computeResults(prev.relaxed)
    const next = applyPatch(prev.relaxed, {})
    const msg: Message = {
      id: newId('ai'),
      sender: 'ai',
      text: "C'est appliqué. Votre recherche intègre désormais cette hypothèse, et la carte est à jour.",
      change: 'Hypothèse appliquée à la recherche.',
      ts: Date.now(),
    }
    dispatch({ type: 'APPLY_WHATIF', criteria: next, results, msg })
  }

  function dismissWhatIf() {
    const msg: Message = {
      id: newId('ai'),
      sender: 'ai',
      text: "Entendu, je garde votre recherche telle quelle. L'aperçu est retiré de la carte.",
      ts: Date.now(),
    }
    dispatch({ type: 'DISMISS_WHATIF', msg })
  }

  function flyToCities(cities: string[]) {
    dispatch({ type: 'SELECT', id: null })
    if (cities.length === 1) {
      const c = CITIES.find((x) => x.name.toLowerCase() === cities[0].toLowerCase())
      if (c) dispatch({ type: 'SET_VIEW', center: [c.lng, c.lat], zoom: c.zoom })
    }
  }

  const value = useMemo(
    () => ({ state, dispatch, send, sendDraft, applyWhatIf, dismissWhatIf, flyToCities }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore hors StoreProvider')
  return ctx
}

