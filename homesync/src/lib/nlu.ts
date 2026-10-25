import type { Criteria } from '../types'
import { findCities } from '../data/cities'

/**
 * Compréhension du langage *simulée* pour la démonstration.
 * Ce n'est PAS un vrai modèle de langage : un analyseur par mots-clés qui
 * extrait des critères d'une phrase en français. Transparent et prévisible.
 */

export function emptyCriteria(isCompany: boolean): Criteria {
  return {
    cities: [],
    rooms: null,
    budgetMax: null,
    budgetBasis: null,
    furnished: null,
    isCompany,
    units: null,
    people: null,
    durationMonths: null,
    startDate: null,
    requirements: [],
    preferences: [],
    toConfirm: [],
  }
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** Mots-clés de préférences négociables repérables dans une phrase. */
const PREF_KEYWORDS: Record<string, string> = {
  balcon: 'Balcon',
  terrasse: 'Terrasse',
  parking: 'Parking',
  garage: 'Parking',
  ascenseur: 'Ascenseur',
  jardin: 'Jardin',
  tram: 'Tramway',
  tramway: 'Tramway',
  metro: 'Métro',
  gare: 'Gare à proximité',
  calme: 'Calme',
  lumineux: 'Lumineux',
  fibre: 'Fibre',
}

export interface ParseResult {
  patch: Partial<Criteria>
  /** Hypothèse « Et si… ? » détectée (non appliquée tant que non confirmée). */
  whatIf?: string
  /** Comparaison explicite de plusieurs villes. */
  compareCities?: string[]
  /** true si rien d'exploitable n'a été compris. */
  empty: boolean
}

export function parse(text: string): ParseResult {
  const t = norm(text)
  const patch: Partial<Criteria> = {}
  let understood = false

  // --- « Et si… ? » : hypothèse, jamais appliquée directement -----------
  if (/\bet si\b|\bsi on\b|\bsi nous\b/.test(t)) {
    return { patch: {}, whatIf: text.trim(), empty: false }
  }

  // --- Villes -----------------------------------------------------------
  const cities = findCities(text).map((c) => c.name)
  if (cities.length) {
    patch.cities = cities
    understood = true
  }

  // Comparaison explicite
  if (/\bcompare|comparer|comparaison|versus|\bvs\b|ou bien\b/.test(t) && cities.length >= 2) {
    return { patch, compareCities: cities, empty: false }
  }

  // --- Type de logement (T1..T6 / studio) -------------------------------
  const tMatch = t.match(/\bt\s?([1-6])\b/) || t.match(/\bf\s?([1-6])\b/)
  if (tMatch) {
    patch.rooms = parseInt(tMatch[1], 10)
    understood = true
  } else if (/\bstudio\b/.test(t)) {
    patch.rooms = 1
    understood = true
  } else {
    const piecesMatch = t.match(/([1-6])\s*pieces?/)
    if (piecesMatch) {
      patch.rooms = parseInt(piecesMatch[1], 10)
      understood = true
    }
  }

  // --- Budget -----------------------------------------------------------
  // ex. "1 200 €", "1200e", "max 900", "1.200 euros"
  const budgetMatch = t.match(/(\d[\d  .]{2,})\s*(?:e|eur|euro|euros|€)?/)
  if (/budget|max|maximum|€|euro|loyer|cc|charges comprises|\bpar mois\b/.test(t) && budgetMatch) {
    const raw = budgetMatch[1].replace(/[  .]/g, '')
    const val = parseInt(raw, 10)
    if (!isNaN(val) && val >= 200 && val <= 20000) {
      patch.budgetMax = val
      patch.budgetBasis = /global|total|au total|budget global/.test(t) ? 'global' : 'par-logement'
      understood = true
    }
  }

  // --- Meublé -----------------------------------------------------------
  if (/\bmeuble|meublee|meubles\b/.test(t)) {
    patch.furnished = !/\bvide\b|non meuble/.test(t)
    understood = true
  } else if (/\bvide\b|non meuble/.test(t)) {
    patch.furnished = false
    understood = true
  }

  // --- Société : logements, personnes, durée, dates ---------------------
  const unitsMatch = t.match(/(\d+)\s*(?:logements?|appartements?|biens?)/)
  if (unitsMatch) {
    patch.units = parseInt(unitsMatch[1], 10)
    understood = true
  } else {
    const wordUnits: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6 }
    const m = t.match(/\b(deux|trois|quatre|cinq|six)\s+(?:logements?|appartements?|biens?)/)
    if (m) {
      patch.units = wordUnits[m[1]]
      understood = true
    }
  }

  const peopleMatch = t.match(/(\d+)\s*(?:collaborateurs?|salaries?|personnes?|employes?)/)
  if (peopleMatch) {
    patch.people = parseInt(peopleMatch[1], 10)
    understood = true
  } else {
    const wordPeople: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8 }
    const m = t.match(/\b(deux|trois|quatre|cinq|six|sept|huit)\s+(?:collaborateurs?|salaries?|personnes?)/)
    if (m) {
      patch.people = wordPeople[m[1]]
      understood = true
    }
  }

  const durMatch = t.match(/(\d+)\s*(mois|semaines?|ans?|annees?)/)
  if (durMatch) {
    const n = parseInt(durMatch[1], 10)
    patch.durationMonths = /mois/.test(durMatch[2]) ? n : /semaine/.test(durMatch[2]) ? Math.round(n / 4) : n * 12
    understood = true
  } else {
    const wordDur: Record<string, number> = { trois: 3, quatre: 4, six: 6, douze: 12 }
    const m = t.match(/\b(trois|quatre|six|douze)\s+mois/)
    if (m) {
      patch.durationMonths = wordDur[m[1]]
      understood = true
    }
  }

  // --- Préférences négociables ------------------------------------------
  const prefs = new Set<string>()
  for (const [kw, label] of Object.entries(PREF_KEYWORDS)) {
    if (new RegExp(`\\b${kw}`).test(t)) prefs.add(label)
  }
  if (prefs.size) {
    patch.preferences = Array.from(prefs)
    understood = true
  }

  return { patch, empty: !understood }
}

/** Fusionne un patch dans les critères, en construisant exigences/préférences. */
export function applyPatch(c: Criteria, patch: Partial<Criteria>): Criteria {
  const next: Criteria = { ...c, ...patch }

  // Les préférences sont cumulatives (on n'écrase pas celles déjà exprimées).
  if (patch.preferences) {
    next.preferences = Array.from(new Set([...c.preferences, ...patch.preferences]))
  }

  // Reconstruit la liste lisible des exigences.
  const req: string[] = []
  if (next.cities.length) req.push(`Ville : ${next.cities.join(' / ')}`)
  if (next.rooms) req.push(`Au moins ${next.rooms} pièces`)
  if (next.budgetMax)
    req.push(
      `Budget ${next.budgetMax} € ${next.budgetBasis === 'global' ? 'au total' : 'par logement'} (CC si possible)`,
    )
  if (next.furnished === true) req.push('Meublé')
  if (next.units) req.push(`${next.units} logements`)
  if (next.people) req.push(`${next.people} personnes à loger`)
  if (next.durationMonths) req.push(`Durée ${next.durationMonths} mois`)
  next.requirements = req

  // Informations à confirmer (côté société surtout).
  const confirm: string[] = []
  if (next.isCompany) {
    if (next.units && !next.durationMonths) confirm.push('Durée du séjour')
    if (!next.startDate) confirm.push('Date de début')
    if (next.units && !next.budgetMax) confirm.push('Budget (par logement ou global)')
  }
  next.toConfirm = confirm

  return next
}
