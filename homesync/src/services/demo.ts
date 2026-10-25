import { computeResults, respond, whatIfPreview } from '../lib/assistant'
import { applyPatch, parse } from '../lib/nlu'
import { catalogService } from './catalog'
import type { HomeSyncServices } from './contracts'

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); reject(new DOMException('Requête annulée', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve() }, ms)
    if (signal?.aborted) aborted()
    else signal?.addEventListener('abort', aborted, { once: true })
  })
}

export const demoServices: HomeSyncServices = {
  mode: 'demo',
  catalog: catalogService,
  search: {
    evaluate: computeResults,
    preview: whatIfPreview,
    async reply(request, signal) {
      await delay(850, signal)
      const parsed = parse(request.text)
      if (parsed.whatIf) {
        const value = whatIfPreview(request.criteria, parsed.whatIf)
        return { kind: 'preview', preview: { question: parsed.whatIf, extraListingIds: value.extraIds, summary: value.summary } }
      }
      const criteria = applyPatch(request.criteria, parsed.patch)
      const results = computeResults(criteria)
      const reply = respond(request.criteria, criteria, results)
      if (parsed.compareCities) reply.cards?.unshift({ kind: 'cities', note: `Comparaison : ${parsed.compareCities.join(' / ')}` })
      return { kind: 'results', criteria, results, reply, compareCities: parsed.compareCities }
    },
  },
  messaging: {
    async send(thread, draftIndex, signal) {
      if (thread.messages[draftIndex]?.from !== 'draft') throw new Error('Brouillon indisponible')
      await delay(350, signal)
      return { ...thread, messages: [
        ...thread.messages.map((message, index) => index === draftIndex ? { ...message, from: 'me' as const } : message),
        { from: 'advertiser', text: 'Merci pour votre demande. La disponibilité et les créneaux de visite restent à confirmer. (Réponse simulée — aucun annonceur réel contacté.)' },
      ] }
    },
  },
}
