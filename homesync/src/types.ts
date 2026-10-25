// Modèle de domaine HomeSync — données de démonstration uniquement.

export type AccountType = 'particulier' | 'societe'

export interface AdvertiserThread {
  listingId: string
  messages: { from: 'me' | 'advertiser' | 'draft'; text: string; participantId?: string }[]
}

/** Rôle au sein d'un projet de recherche (distinct du type de compte). */
export type ProjectRole = 'demandeur' | 'invite' | 'annonceur'

export type MatchTier = 'gold' | 'silver' | 'confirm'
//  gold    = « Meilleur accord »   : exigences + préférences respectées
//  silver  = « Compromis possible » : exigences respectées, 1 préférence cédée
//  confirm = « À confirmer »        : une information nécessaire manque

export interface Participant {
  id: string
  name: string
  initials: string
  color: string
  role: ProjectRole
  /** Lieu important posé sur la carte (ex. lieu de travail). */
  place?: { label: string; lat: number; lng: number }
}

export interface Listing {
  id: string
  title: string
  city: string
  lat: number
  lng: number
  /** Précision de la localisation affichée (honnêteté sur la donnée). */
  locationPrecision: 'exacte' | 'quartier' | 'approximative'
  rooms: number // nombre de pièces (T3 => 3)
  surface: number // m²
  rent: number // loyer hors charges (€/mois)
  charges: number | null // charges (€/mois) — null si non renseigné
  furnished: boolean
  capacity: number // nombre de personnes logeables
  availableFrom: string // ISO date
  photos: string[]
  equipment: string[]
  /** Équipements demandés mais non renseignés dans l'annonce. */
  missingInfo: string[]
  advertiser: { name: string; type: 'agence' | 'propriétaire'; role: 'annonceur' }
}

/** Critères compris par l'assistant à partir de la conversation. */
export interface Criteria {
  cities: string[]
  rooms: number | null // pièces minimum
  budgetMax: number | null // charges comprises si possible
  budgetBasis: 'par-logement' | 'global' | null
  furnished: boolean | null
  // Société
  isCompany: boolean
  units: number | null // nombre de logements recherchés
  people: number | null // nombre de personnes à loger
  durationMonths: number | null
  startDate: string | null
  /** Distinction exigences / préférences / à confirmer. */
  requirements: string[]
  preferences: string[]
  toConfirm: string[]
}

export type Sender = 'ai' | string // 'ai' ou id de participant

export interface ChatCard {
  kind: 'listing' | 'compare' | 'cities'
  listingIds?: string[]
  note?: string
}

export interface Message {
  id: string
  sender: Sender
  text: string
  cards?: ChatCard[]
  /** Explication courte « ce qui a changé » après une mise à jour. */
  change?: string
  ts: number
}

export type AppState =
  | 'idle' // vue France, aucune recherche
  | 'updating' // « Mise à jour de votre recherche… »
  | 'results' // annonces affichées
  | 'empty' // aucun résultat
  | 'error' // erreur de démonstration

/** Hypothèse « Et si… ? » — aperçu temporaire non appliqué. */
export interface WhatIf {
  question: string
  extraListingIds: string[]
  summary: string
}
