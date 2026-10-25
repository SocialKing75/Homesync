import { LISTINGS } from '../data/listings'
import type { Listing } from '../types'
import type { CatalogAdapter, CatalogService } from './contracts'

/** Seul ce module lit le jeu de logements fictifs. Les vues lisent le cache. */
export function createCatalogService(adapter: CatalogAdapter, initial: Listing[] = []): CatalogService {
  let snapshot = initial
  let revision = 0
  return {
    async list(signal) {
      const request = ++revision
      const listings = await adapter.list(signal)
      if (signal?.aborted) throw new DOMException('Requête annulée', 'AbortError')
      if (request === revision) snapshot = listings
      return listings
    },
    getSnapshot: () => snapshot,
    getById: (id) => snapshot.find(listing => listing.id === id),
  }
}

export const catalogService = createCatalogService({
  async list(signal) {
    if (signal?.aborted) throw new DOMException('Requête annulée', 'AbortError')
    return LISTINGS
  },
}, LISTINGS)

// Lectures synchrones du catalogue déjà chargé, jamais d'appel réseau au rendu.
export const getListings = () => catalogService.getSnapshot()
export const getListing = (id: string) => catalogService.getById(id)
