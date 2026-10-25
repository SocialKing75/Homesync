import type { Criteria, Listing, MatchTier } from '../types'

export interface MatchResult {
  tier: MatchTier
  total: number | null // loyer + charges si connu
  reasons: string[] // pour « Pourquoi cette zone ? »
  concession?: string // préférence cédée (Argent)
  missing: string[] // informations à confirmer
  /** false = n'entre pas dans la recherche (exigence non respectée). */
  included: boolean
}

export function totalCost(l: Listing): number | null {
  return l.charges === null ? null : l.rent + l.charges
}

/**
 * Évalue un logement au regard des critères compris.
 * Les catégories ne classent pas la qualité des quartiers : elles décrivent
 * l'adéquation aux exigences et préférences communes du projet.
 */
export function evaluate(l: Listing, c: Criteria): MatchResult {
  const reasons: string[] = []
  const missing: string[] = [...l.missingInfo]
  const total = totalCost(l)

  // --- Exigences indispensables ------------------------------------------
  if (c.cities.length && !c.cities.map((x) => x.toLowerCase()).includes(l.city.toLowerCase())) {
    return { tier: 'confirm', total, reasons: ['Hors des villes recherchées'], missing, included: false }
  }
  if (c.rooms && l.rooms < c.rooms) {
    return {
      tier: 'confirm',
      total,
      reasons: [`${l.rooms} pièce(s) — exigence : au moins ${c.rooms}`],
      missing,
      included: false,
    }
  }
  if (c.furnished === true && !l.furnished) {
    return { tier: 'confirm', total, reasons: ['Non meublé — exigence : meublé'], missing, included: false }
  }

  if (c.furnished === false && l.furnished) return { tier: 'confirm', total, reasons: ['Meublé - exigence : non meublé'], missing, included: false }

  // Le budget maximal par logement est une exigence stricte.
  if (c.budgetMax && c.budgetBasis !== 'global' && (l.rent > c.budgetMax || (total !== null && total > c.budgetMax))) {
    return {
      tier: 'confirm',
      total,
      reasons: [`${total} € CC — au-delà du budget de ${c.budgetMax} €`],
      missing,
      included: false,
    }
  }

  // --- À confirmer : une information nécessaire manque -------------------
  if (c.budgetMax && l.charges === null) {
    missing.push('Charges non renseignées (budget à confirmer)')
  }
  if (l.locationPrecision === 'approximative') {
    missing.push('Localisation approximative')
  }
  if (missing.length > 0) {
    reasons.push('Correspond aux exigences, mais une information manque pour confirmer')
    return { tier: 'confirm', total, reasons, missing: dedupe(missing), included: true }
  }

  // --- Préférences négociables : Gold vs Argent -------------------------
  if (c.rooms) reasons.push(`${l.rooms} pièces — exigence respectée`)
  if (c.furnished === true) reasons.push('Meublé — exigence respectée')

  let concession: string | undefined

  // Préférence budget : confortablement sous le plafond.
  if (c.budgetMax && c.budgetBasis !== 'global' && total !== null) {
    if (total <= c.budgetMax * 0.9) {
      reasons.push(`${total} € CC — bien sous le budget`)
    } else {
      concession = 'Budget serré (proche du plafond)'
    }
  }

  // Préférences exprimées dans la conversation, recherchées dans les équipements.
  const satisfied: string[] = []
  const unmet: string[] = []
  for (const pref of c.preferences) {
    const hit = l.equipment.some((e) => e.toLowerCase().includes(pref.toLowerCase()))
    if (hit) satisfied.push(pref)
    else unmet.push(pref)
  }
  satisfied.forEach((p) => reasons.push(`Préférence « ${p} » satisfaite`))
  if (unmet.length) concession = [concession, ...unmet.map((p) => `Préférence « ${p} » à confirmer`)].filter(Boolean).join(' ; ')

  if (concession) {
    reasons.push(concession)
    return { tier: 'silver', total, reasons, concession, missing: [], included: true }
  }

  reasons.push('Toutes les préférences communes sont satisfaites')
  return { tier: 'gold', total, reasons, missing: [], included: true }
}

function dedupe(a: string[]): string[] {
  return Array.from(new Set(a))
}
