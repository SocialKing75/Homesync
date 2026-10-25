import { test, expect } from '@playwright/test'
import { parse, applyPatch, emptyCriteria } from '../src/lib/nlu'
import { computeResults, whatIfPreview } from '../src/lib/assistant'
import { totalCost } from '../src/lib/matching'
import { SCENARIOS } from '../src/data/scenarios'

test('les trois scénarios font évoluer les résultats', () => {
  for (const scenario of SCENARIOS) {
    let criteria = emptyCriteria(scenario.profile === 'societe')
    const counts: number[] = []
    for (const text of scenario.messages) {
      const parsed = parse(text)
      if (!parsed.whatIf) criteria = applyPatch(criteria, parsed.patch)
      counts.push(computeResults(criteria).included.length)
    }
    expect(counts[0]).toBeGreaterThan(0)
    expect(new Set(counts).size).toBeGreaterThan(1)
  }
})

test('budget strict, non meublé et absence de faux calcul de trajet', () => {
  const criteria = applyPatch(emptyCriteria(false), parse('Un T3 à Nantes budget maximum 1050 € non meublé').patch)
  expect(criteria.furnished).toBe(false)
  const result = computeResults(criteria)
  expect(result.included.length).toBeGreaterThan(0)
  expect(result.included.every(l => !l.furnished && (totalCost(l) === null || totalCost(l)! <= 1050))).toBe(true)
  const preview = whatIfPreview(criteria, 'Et si on acceptait 10 minutes de trajet ?')
  expect(preview.relaxed).toEqual(criteria)
  expect(preview.extraIds).toEqual([])
  const empty = computeResults(applyPatch(emptyCriteria(true), parse('Logement meublé à Lille budget maximum 200 €').patch))
  expect(empty.included).toHaveLength(0)
})

test('Gold et Argent suivent les seuils et les préférences', () => {
  const criteria = applyPatch(emptyCriteria(false), parse('Un T3 à Nantes budget maximum 1200 € avec balcon').patch)
  const result = computeResults(criteria)
  expect(result.silver.length).toBeGreaterThan(0)
  expect(result.gold.every(l => totalCost(l)! <= 1080 && l.equipment.includes('Balcon'))).toBe(true)
  expect(result.confirm.every(l => result.evaluations[l.id].missing.length > 0)).toBe(true)
})
