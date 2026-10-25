import type { AdvertiserThread, Criteria, Listing, Message, WhatIf } from '../types'
import type { AssistantReply, Results } from '../lib/assistant'

/** Contrats frontend ; aucun chemin HTTP n'est présumé. */
export interface CatalogAdapter {
  list(signal?: AbortSignal): Promise<Listing[]>
}
export interface CatalogService {
  list(signal?: AbortSignal): Promise<Listing[]>
  getSnapshot(): Listing[]
  getById(id: string): Listing | undefined
}
export interface ConversationRequest {
  text: string
  senderId: string
  criteria: Criteria
  history: Message[]
}
export type ConversationResponse =
  | { kind: 'results'; criteria: Criteria; results: Results; reply: AssistantReply; compareCities?: string[] }
  | { kind: 'preview'; preview: WhatIf }

export interface SearchService {
  reply(request: ConversationRequest, signal?: AbortSignal): Promise<ConversationResponse>
  evaluate(criteria: Criteria): Results
  preview(criteria: Criteria, question: string): { extraIds: string[]; summary: string; relaxed: Criteria }
}
export interface MessagingService {
  send(thread: AdvertiserThread, draftIndex: number, signal?: AbortSignal): Promise<AdvertiserThread>
}
export interface HomeSyncServices {
  mode: 'demo' | 'connected'
  catalog: CatalogService
  search: SearchService
  messaging: MessagingService
}
