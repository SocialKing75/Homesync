import { test, expect } from '@playwright/test'
import { summarizeListings } from '../src/lib/analytics'
import { LISTINGS } from '../src/data/listings'

test('analyse : périmètre exact, totaux connus uniquement et répartition complète', () => {
  const pool = LISTINGS.filter(l => l.city === 'Lille')
  const stats = summarizeListings(pool)
  const prices = pool.filter(l => l.charges !== null).map(l => l.rent + l.charges!)
  expect(stats.count).toBe(pool.length)
  expect(stats.knownPriceCount).toBe(prices.length)
  expect(stats.min).toBe(Math.min(...prices))
  expect(stats.max).toBe(Math.max(...prices))
  expect(stats.rooms.reduce((sum, r) => sum + r.count, 0)).toBe(pool.length)
  expect(stats.knownPriceCount).toBeLessThan(stats.count)
})
test('analyse : aucun prix inventé pour un périmètre vide', () => {
  expect(summarizeListings([])).toEqual({ count: 0, knownPriceCount: 0, min: null, max: null, rooms: [] })
})
