import type { ChatCard, Criteria, Listing } from '../types'
import { evaluate, totalCost, type MatchResult } from './matching'
import { getListings } from '../services/catalog'

export interface Results {
  evaluations: Record<string, MatchResult>
  included: Listing[]
  gold: Listing[]
  silver: Listing[]
  confirm: Listing[]
}

export function computeResults(c: Criteria): Results {
  const evaluations: Record<string, MatchResult> = {}
  const gold: Listing[] = []
  const silver: Listing[] = []
  const confirm: Listing[] = []
  const included: Listing[] = []

  // Si aucune ville n'est précisée, on n'affiche pas d'annonces : vue France.
  const pool = c.cities.length
    ? getListings().filter((l) => c.cities.map((x) => x.toLowerCase()).includes(l.city.toLowerCase()))
    : []

  for (const l of pool) {
    const r = evaluate(l, c)
    evaluations[l.id] = r
    if (!r.included) continue
    included.push(l)
    if (r.tier === 'gold') gold.push(l)
    else if (r.tier === 'silver') silver.push(l)
    else confirm.push(l)
  }
  return { evaluations, included, gold, silver, confirm }
}

/** Faisabilité du groupe pour une recherche société. */
export interface Feasibility {
  capacityOk: boolean
  capacityTotal: number
  budgetOk: boolean | null
  budgetTotal: number | null
  datesOk: boolean | null
  note: string
}

export function groupFeasibility(c: Criteria, selected: Listing[]): Feasibility | null {
  if (!c.isCompany || !c.units) return null
  const capacityTotal = selected.reduce((s, l) => s + l.capacity, 0)
  const capacityOk = c.people ? capacityTotal >= c.people : true
  const budgetTotal = selected.every((l) => totalCost(l) !== null)
    ? selected.reduce((s, l) => s + (totalCost(l) ?? 0), 0)
    : null
  let budgetOk: boolean | null = null
  if (c.budgetMax) {
    if (c.budgetBasis === 'global') budgetOk = budgetTotal !== null ? budgetTotal <= c.budgetMax : null
    else budgetOk = selected.every((l) => (totalCost(l) ?? Infinity) <= c.budgetMax!)
  }
  const datesOk = c.startDate ? selected.every((l) => l.availableFrom <= c.startDate!) : null
  const note = `${selected.length}/${c.units} logements · ${capacityTotal} personnes logeables`
  return { capacityOk, capacityTotal, budgetOk, budgetTotal, datesOk, note }
}

/** Réponse de l'assistant après prise en compte d'un message. */
export interface AssistantReply {
  text: string
  change?: string
  cards?: ChatCard[]
  suggestions: string[]
}

const euro = (n: number) => `${n.toLocaleString('fr-FR')} €`

export function respond(prev: Criteria, next: Criteria, results: Results): AssistantReply {
  const added: string[] = []
  if (next.cities.join() !== prev.cities.join() && next.cities.length)
    added.push(`ville${next.cities.length > 1 ? 's' : ''} : ${next.cities.join(' et ')}`)
  if (next.rooms !== prev.rooms && next.rooms) added.push(`au moins ${next.rooms} pièces`)
  if (next.budgetMax !== prev.budgetMax && next.budgetMax)
    added.push(`budget ${euro(next.budgetMax)} ${next.budgetBasis === 'global' ? 'global' : 'par logement'}`)
  if (next.furnished !== prev.furnished && next.furnished) added.push('meublé')
  if (next.units !== prev.units && next.units) added.push(`${next.units} logements`)
  if (next.people !== prev.people && next.people) added.push(`${next.people} personnes`)
  if (next.durationMonths !== prev.durationMonths && next.durationMonths)
    added.push(`durée ${next.durationMonths} mois`)

  const change = added.length ? `J'ai noté : ${added.join(', ')}.` : undefined
  const n = results.included.length
  const suggestions: string[] = []
  const budgetSuggestion = `Budget maximum ${(next.budgetMax ?? 1050) + 150} €`

  // Rien compris
  if (!added.length && next.cities.length === 0) {
    return {
      text: "Je n'ai pas saisi de critère exploitable. Dites-moi par exemple une ville, un type de logement (T2, T3…) ou un budget.",
      suggestions: ['On cherche un T3 à Nantes', 'Budget 1 200 € charges comprises', 'Logement meublé à Lille'],
    }
  }

  // Ville sans annonce de démo
  if (next.cities.length && n === 0) {
    return {
      text: `${change ?? ''} Je n'ai aucune annonce de démonstration correspondant à ces critères pour le moment. Vous pouvez assouplir une exigence ou explorer une autre ville.`.trim(),
      change,
      suggestions: [budgetSuggestion, 'Accepter un T2', 'Un T2 à Lyon budget maximum 1 200 €'],
    }
  }

  const parts: string[] = []
  if (change) parts.push(change)

  if (next.isCompany && next.units) {
    parts.push(
      `J'ai trouvé ${n} logement${n > 1 ? 's' : ''} compatibles à ${next.cities.join(' et ')}. ` +
        `Je distingue l'adéquation de chaque logement et la faisabilité du groupe (capacité, budget total, dates).`,
    )
    if (next.toConfirm.length) parts.push(`À confirmer pour finaliser : ${next.toConfirm.join(', ')}.`)
    suggestions.push(
      'Logements meublés à Lille',
      'Budget global 3 500 € par mois',
      'Séjour de 4 mois',
    )
  } else {
    parts.push(
      `${results.gold.length} en « Meilleur accord » (Gold), ${results.silver.length} en « Compromis possible » (Argent)` +
        (results.confirm.length ? `, ${results.confirm.length} à confirmer` : '') +
        `. La carte est à jour.`,
    )
    suggestions.push('Montre les logements avec balcon', 'Et si on acceptait une pièce de moins ?', budgetSuggestion)
  }

  const cards: ChatCard[] = []
  const featured = [...results.gold, ...results.silver].slice(0, 2)
  if (!featured.length) featured.push(...results.confirm.slice(0, 2))
  if (featured.length) cards.push({ kind: 'listing', listingIds: featured.map((l) => l.id) })

  return { text: parts.join(' '), change, cards, suggestions }
}

/** Aperçu « Et si… ? » — calcule les annonces ajoutées sans rien appliquer. */
export function whatIfPreview(c: Criteria, question: string): { extraIds: string[]; summary: string; relaxed: Criteria } {
  const relaxed: Criteria = { ...c }
  const q = question.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

  if (/budget|€|euro|cher|prix/.test(q) && c.budgetMax) {
    relaxed.budgetMax = Math.round(c.budgetMax * 1.12)
  } else if (/trajet|minute|loin|proche|rayon|distance/.test(q)) {
    return { extraIds: [], summary: "Temps de trajet à confirmer : aucun calcul disponible. Aucun critère modifié.", relaxed }
  } else if (/t2|une piece|piece de moins/.test(q) && c.rooms) {
    relaxed.rooms = Math.max(1, c.rooms - 1)
  } else if (c.budgetMax) {
    relaxed.budgetMax = Math.round(c.budgetMax * 1.1)
  } else if (c.rooms) {
    relaxed.rooms = Math.max(1, c.rooms - 1)
  }

  const before = new Set(computeResults(c).included.map((l) => l.id))
  const after = computeResults(relaxed).included
  const extraIds = after.map((l) => l.id).filter((id) => !before.has(id))
  const summary =
    extraIds.length > 0
      ? `Cette hypothèse ajoute ${extraIds.length} logement${extraIds.length > 1 ? 's' : ''}.`
      : "Cette hypothèse n'ajoute aucun logement de démonstration."
  return { extraIds, summary, relaxed }
}
