import type { Listing } from '../types'
import { totalCost } from './matching'

export function summarizeListings(listings: Listing[]) {
  const knownPrices = listings.map(totalCost).filter((v): v is number => v !== null)
  const rooms = [...new Set(listings.map(l => l.rooms))].sort((a, b) => a - b).map(n => ({ rooms: n, count: listings.filter(l => l.rooms === n).length }))
  return { count: listings.length, knownPriceCount: knownPrices.length, min: knownPrices.length ? Math.min(...knownPrices) : null, max: knownPrices.length ? Math.max(...knownPrices) : null, rooms }
}
