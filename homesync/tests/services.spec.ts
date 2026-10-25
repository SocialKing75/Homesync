import { test, expect } from '@playwright/test'
import { createCatalogService } from '../src/services/catalog'
import { dataServices } from '../src/services'
import { LISTINGS } from '../src/data/listings'
import { emptyCriteria } from '../src/lib/nlu'

test('catalogue : adapter asynchrone, cache partagé et erreur sans perte des données', async () => {
  let fail = false
  const service = createCatalogService({ async list() { if (fail) throw new Error('Indisponible'); return [LISTINGS[0]] } })
  expect(service.getSnapshot()).toEqual([])
  await service.list()
  expect(service.getById(LISTINGS[0].id)).toEqual(LISTINGS[0])
  fail = true
  await expect(service.list()).rejects.toThrow('Indisponible')
  expect(service.getSnapshot()).toEqual([LISTINGS[0]])
})

test('catalogue : annulation et réponse obsolète ne remplacent pas le cache', async () => {
  const pending: ((value: typeof LISTINGS) => void)[] = []
  const service = createCatalogService({ list: () => new Promise(resolve => pending.push(resolve)) })
  const first = service.list(); const second = service.list()
  pending[1]([LISTINGS[1]]); await second
  pending[0]([LISTINGS[0]]); await first
  expect(service.getSnapshot()).toEqual([LISTINGS[1]])
  const controller = new AbortController()
  const cancelled = service.list(controller.signal)
  controller.abort(); pending[2]([LISTINGS[2]])
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  expect(service.getSnapshot()).toEqual([LISTINGS[1]])
})

test('conversation : résultats Gold/Argent inchangés et requête annulable', async () => {
  const request = { text: 'Un T3 à Nantes budget maximum 1200 €', senderId: 'me', criteria: emptyCriteria(false), history: [] }
  const result = await dataServices.search.reply(request)
  expect(result.kind).toBe('results')
  if (result.kind !== 'results') return
  expect(result.results.included).toHaveLength(4)
  expect(result.results.gold).toHaveLength(1)
  expect(result.results.silver).toHaveLength(2)
  expect(result.results.confirm).toHaveLength(1)
  const controller = new AbortController()
  const cancelled = dataServices.search.reply(request, controller.signal)
  controller.abort()
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  const criteriaBefore = JSON.stringify(result.criteria)
  const preview = await dataServices.search.reply({ ...request, text: 'Et si on augmentait le budget ?', criteria: result.criteria })
  expect(preview.kind).toBe('preview')
  expect(JSON.stringify(result.criteria)).toBe(criteriaBefore)
})

test('messagerie : brouillon conservé, envoi explicite et pas de double réponse', async () => {
  const thread = { listingId: 'nte1', messages: [{ from: 'draft' as const, text: 'Une visite est-elle possible ?' }] }
  const response = await dataServices.messaging.send(thread, 0)
  expect(thread.messages[0].from).toBe('draft')
  expect(response.messages.map(m => m.from)).toEqual(['me', 'advertiser'])
  expect(response.messages[1].text).toContain('Réponse simulée')
  await expect(dataServices.messaging.send(response, 0)).rejects.toThrow('Brouillon indisponible')
})
