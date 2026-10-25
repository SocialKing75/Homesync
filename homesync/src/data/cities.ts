// Référentiel géographique de démonstration.
// Une carte nationale ne signifie pas que des annonces réelles existent partout.

export interface CityRef {
  name: string
  lat: number
  lng: number
  /** Niveau de zoom confortable pour cette ville. */
  zoom: number
  /** Alias de reconnaissance dans la conversation (minuscules, sans accent). */
  aliases: string[]
}

export const FRANCE_CENTER: [number, number] = [46.6, 2.45]
export const FRANCE_ZOOM = 6

export const CITIES: CityRef[] = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522, zoom: 12, aliases: ['paris'] },
  { name: 'Lyon', lat: 45.764, lng: 4.8357, zoom: 12, aliases: ['lyon'] },
  { name: 'Marseille', lat: 43.2965, lng: 5.3698, zoom: 12, aliases: ['marseille'] },
  { name: 'Lille', lat: 50.6292, lng: 3.0573, zoom: 12, aliases: ['lille'] },
  { name: 'Nantes', lat: 47.2184, lng: -1.5536, zoom: 12, aliases: ['nantes'] },
  { name: 'Bordeaux', lat: 44.8378, lng: -0.5792, zoom: 12, aliases: ['bordeaux'] },
  { name: 'Toulouse', lat: 43.6047, lng: 1.4442, zoom: 12, aliases: ['toulouse'] },
  { name: 'Strasbourg', lat: 48.5734, lng: 7.7521, zoom: 12, aliases: ['strasbourg'] },
  { name: 'Rennes', lat: 48.1173, lng: -1.6778, zoom: 12, aliases: ['rennes'] },
]

/** Raccourcis de vue — dont territoires ultramarins (aucune annonce de démo). */
export interface ViewShortcut {
  label: string
  center: [number, number]
  zoom: number
  /** true = pas de données d'annonces de démonstration pour ce territoire. */
  noData?: boolean
}

export const SHORTCUTS: ViewShortcut[] = [
  { label: 'Vue France', center: FRANCE_CENTER, zoom: FRANCE_ZOOM },
  { label: 'Guadeloupe', center: [16.25, -61.55], zoom: 9, noData: true },
  { label: 'Martinique', center: [14.64, -61.02], zoom: 10, noData: true },
  { label: 'Guyane', center: [4.0, -53.0], zoom: 7, noData: true },
  { label: 'La Réunion', center: [-21.11, 55.53], zoom: 9, noData: true },
  { label: 'Mayotte', center: [-12.82, 45.16], zoom: 10, noData: true },
]

export function findCity(text: string): CityRef | undefined {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  return CITIES.find((c) => c.aliases.some((a) => t.includes(a)))
}

export function findCities(text: string): CityRef[] {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  return CITIES.filter((c) => c.aliases.some((a) => t.includes(a)))
}
