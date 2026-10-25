import type { Listing } from '../types'

// ⚠️ Annonces FICTIVES — données de démonstration.
// Prix, photos, équipements et disponibilités ne sont pas des informations vérifiées.

const INTERIORS = ['photo-1600210492486-724fe5c67fb0', 'photo-1600607687920-4e2a09cf159d', 'photo-1600566753086-00f18fb6b3ea']
// Photos d'illustration : elles ne représentent aucun bien réellement proposé.
const photo = (seed: string) => `https://images.unsplash.com/${INTERIORS[[...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % INTERIORS.length]}?auto=format&fit=crop&w=800&q=80`

function mk(
  id: string,
  city: string,
  lat: number,
  lng: number,
  o: Partial<Listing> & Pick<Listing, 'title' | 'rooms' | 'surface' | 'rent'>,
): Listing {
  return {
    id,
    city,
    lat,
    lng,
    locationPrecision: 'quartier',
    charges: 80,
    furnished: false,
    capacity: Math.max(1, (o.rooms ?? 1) - 1) + 1,
    availableFrom: '2026-11-15',
    photos: [photo(id + 'a'), photo(id + 'b'), photo(id + 'c')],
    equipment: ['Cuisine équipée', 'Chauffage collectif', 'Fibre'],
    missingInfo: [],
    advertiser: { name: 'Agence Horizon', type: 'agence', role: 'annonceur' },
    ...o,
  }
}

export const LISTINGS: Listing[] = [
  // ---- Nantes (parcours particulier : T3) ---------------------------------
  mk('nte1', 'Nantes', 47.2112, -1.5599, {
    title: 'T3 lumineux — Île de Nantes',
    rooms: 3,
    surface: 64,
    rent: 980,
    charges: 110,
    capacity: 4,
    locationPrecision: 'exacte',
    equipment: ['Balcon', 'Cuisine équipée', 'Ascenseur', 'Fibre', 'Tramway : accès à confirmer'],
  }),
  mk('nte2', 'Nantes', 47.2276, -1.5461, {
    title: 'T3 rénové — Hauts-Pavés',
    rooms: 3,
    surface: 59,
    rent: 1010,
    charges: 90,
    capacity: 4,
    equipment: ['Parquet', 'Cuisine équipée', 'Cave', 'Fibre'],
    advertiser: { name: 'M. Besnard', type: 'propriétaire', role: 'annonceur' },
  }),
  mk('nte3', 'Nantes', 47.2045, -1.5706, {
    title: 'T3 avec terrasse — Chantenay',
    rooms: 3,
    surface: 68,
    rent: 1120,
    charges: null,
    capacity: 4,
    locationPrecision: 'approximative',
    equipment: ['Terrasse', 'Parking', 'Cuisine équipée'],
    missingInfo: ['Montant des charges', 'Classe énergétique'],
  }),
  mk('nte4', 'Nantes', 47.233, -1.5215, {
    title: 'T3 proche fac — Doulon',
    rooms: 3,
    surface: 61,
    rent: 890,
    charges: 95,
    capacity: 4,
    equipment: ['Cuisine équipée', 'Local vélo', 'Tramway : accès à confirmer'],
  }),
  mk('nte5', 'Nantes', 47.198, -1.542, {
    title: 'T2 cosy — Rezé bord de Loire',
    rooms: 2,
    surface: 44,
    rent: 720,
    charges: 60,
    capacity: 2,
    equipment: ['Vue Loire', 'Cuisine équipée'],
  }),

  // ---- Lille (parcours société : meublés) ---------------------------------
  mk('lil1', 'Lille', 50.6329, 3.0586, {
    title: 'Studio meublé — Vieux-Lille',
    rooms: 1,
    surface: 28,
    rent: 650,
    charges: 70,
    furnished: true,
    capacity: 1,
    availableFrom: '2026-12-01',
    equipment: ['Meublé', 'Wifi inclus', 'Ménage en option'],
  }),
  mk('lil2', 'Lille', 50.6205, 3.0725, {
    title: 'T2 meublé — Euralille',
    rooms: 2,
    surface: 46,
    rent: 890,
    charges: 120,
    furnished: true,
    capacity: 2,
    availableFrom: '2026-12-01',
    equipment: ['Meublé', 'Gare : accès à confirmer', 'Wifi inclus', 'Salle de sport'],
  }),
  mk('lil3', 'Lille', 50.6418, 3.0403, {
    title: 'T2 meublé — Gambetta',
    rooms: 2,
    surface: 43,
    rent: 840,
    charges: 100,
    furnished: true,
    capacity: 2,
    availableFrom: '2026-12-10',
    equipment: ['Meublé', 'Métro : accès à confirmer', 'Wifi inclus'],
  }),
  mk('lil4', 'Lille', 50.6098, 3.0498, {
    title: 'T3 meublé — Wazemmes',
    rooms: 3,
    surface: 62,
    rent: 1050,
    charges: 130,
    furnished: true,
    capacity: 3,
    availableFrom: '2026-12-01',
    equipment: ['Meublé', 'Marché à proximité', 'Wifi inclus'],
  }),
  mk('lil5', 'Lille', 50.6512, 3.0776, {
    title: 'Studio meublé — Saint-Maurice',
    rooms: 1,
    surface: 25,
    rent: 590,
    charges: null,
    furnished: true,
    capacity: 1,
    availableFrom: '2026-12-01',
    equipment: ['Meublé', 'Wifi inclus'],
    missingInfo: ['Montant des charges'],
  }),
  mk('lil6', 'Lille', 50.628, 3.095, {
    title: 'T2 meublé — Fives',
    rooms: 2,
    surface: 40,
    rent: 760,
    charges: 90,
    furnished: true,
    capacity: 2,
    availableFrom: '2027-01-05',
    equipment: ['Meublé', 'Wifi inclus', 'Parking'],
  }),

  // ---- Paris --------------------------------------------------------------
  mk('par1', 'Paris', 48.8656, 2.3212, {
    title: 'T2 haussmannien — 8e',
    rooms: 2,
    surface: 48,
    rent: 1850,
    charges: 160,
    capacity: 2,
    equipment: ['Moulures', 'Gardien', 'Métro : accès à confirmer'],
  }),
  mk('par2', 'Paris', 48.8438, 2.3876, {
    title: 'T3 familial — 12e Bercy',
    rooms: 3,
    surface: 66,
    rent: 2200,
    charges: 180,
    capacity: 4,
    equipment: ['Balcon', 'Ascenseur', 'Parc à proximité'],
  }),
  mk('par3', 'Paris', 48.8721, 2.3652, {
    title: 'Studio meublé — 10e',
    rooms: 1,
    surface: 26,
    rent: 1150,
    charges: 90,
    furnished: true,
    capacity: 1,
    equipment: ['Meublé', 'Wifi inclus', 'Canal Saint-Martin'],
  }),

  // ---- Lyon ---------------------------------------------------------------
  mk('lyo1', 'Lyon', 45.7685, 4.8343, {
    title: 'T3 Croix-Rousse',
    rooms: 3,
    surface: 70,
    rent: 1250,
    charges: 120,
    capacity: 4,
    equipment: ['Vue', 'Cave', 'Métro : accès à confirmer'],
  }),
  mk('lyo2', 'Lyon', 45.7485, 4.8467, {
    title: 'T2 Part-Dieu',
    rooms: 2,
    surface: 45,
    rent: 950,
    charges: 110,
    capacity: 2,
    equipment: ['Gare : accès à confirmer', 'Cuisine équipée'],
  }),
  mk('lyo3', 'Lyon', 45.7579, 4.819, {
    title: 'T4 Confluence',
    rooms: 4,
    surface: 92,
    rent: 1680,
    charges: 150,
    capacity: 5,
    equipment: ['Terrasse', 'Parking', 'Ascenseur'],
  }),

  // ---- Marseille ----------------------------------------------------------
  mk('mrs1', 'Marseille', 43.2925, 5.3758, {
    title: 'T3 vue mer — Le Panier',
    rooms: 3,
    surface: 63,
    rent: 980,
    charges: 90,
    capacity: 4,
    equipment: ['Vue mer', 'Climatisation'],
  }),
  mk('mrs2', 'Marseille', 43.2855, 5.3912, {
    title: 'T2 meublé — La Plaine',
    rooms: 2,
    surface: 41,
    rent: 780,
    charges: 70,
    furnished: true,
    capacity: 2,
    equipment: ['Meublé', 'Wifi inclus', 'Métro : accès à confirmer'],
  }),

  // ---- Bordeaux (comparaison) --------------------------------------------
  mk('bdx1', 'Bordeaux', 44.8412, -0.573, {
    title: 'T3 échoppe — Chartrons',
    rooms: 3,
    surface: 72,
    rent: 1180,
    charges: 100,
    capacity: 4,
    equipment: ['Jardinet', 'Tramway : accès à confirmer', 'Cuisine équipée'],
  }),
  mk('bdx2', 'Bordeaux', 44.826, -0.5805, {
    title: 'T2 — Saint-Michel',
    rooms: 2,
    surface: 47,
    rent: 820,
    charges: 80,
    capacity: 2,
    equipment: ['Pierre apparente', 'Marché'],
  }),
  mk('bdx3', 'Bordeaux', 44.8588, -0.5784, {
    title: 'T3 neuf — Bacalan',
    rooms: 3,
    surface: 65,
    rent: 1090,
    charges: 110,
    capacity: 4,
    equipment: ['Balcon', 'Parking', 'Fibre', 'Tramway : accès à confirmer'],
  }),

  // ---- Toulouse (comparaison) --------------------------------------------
  mk('tls1', 'Toulouse', 43.6007, 1.4491, {
    title: 'T3 — Carmes',
    rooms: 3,
    surface: 68,
    rent: 1050,
    charges: 95,
    capacity: 4,
    equipment: ['Balcon', 'Métro : accès à confirmer', 'Cuisine équipée'],
  }),
  mk('tls2', 'Toulouse', 43.6115, 1.4302, {
    title: 'T2 meublé — Compans',
    rooms: 2,
    surface: 44,
    rent: 760,
    charges: 85,
    furnished: true,
    capacity: 2,
    equipment: ['Meublé', 'Wifi inclus', 'Métro : accès à confirmer'],
  }),
  mk('tls3', 'Toulouse', 43.588, 1.455, {
    title: 'T4 — Saint-Cyprien',
    rooms: 4,
    surface: 88,
    rent: 1390,
    charges: 120,
    capacity: 5,
    equipment: ['Terrasse', 'Garage', 'Cuisine équipée'],
  }),

  // ---- Strasbourg ---------------------------------------------------------
  mk('stg1', 'Strasbourg', 48.5819, 7.7441, {
    title: 'T3 — Krutenau',
    rooms: 3,
    surface: 66,
    rent: 1020,
    charges: 110,
    capacity: 4,
    equipment: ['Vélo-friendly', 'Tram : accès à confirmer'],
  }),
  mk('stg2', 'Strasbourg', 48.5664, 7.7542, {
    title: 'T2 — Esplanade',
    rooms: 2,
    surface: 43,
    rent: 740,
    charges: 90,
    capacity: 2,
    equipment: ['Proche université', 'Cuisine équipée'],
  }),

  // ---- Rennes -------------------------------------------------------------
  mk('ren1', 'Rennes', 48.1119, -1.6802, {
    title: 'T3 — Centre Historique',
    rooms: 3,
    surface: 62,
    rent: 920,
    charges: 85,
    capacity: 4,
    equipment: ['Pierre', 'Métro : accès à confirmer'],
  }),
  mk('ren2', 'Rennes', 48.1262, -1.6416, {
    title: 'T2 meublé — Beaulieu',
    rooms: 2,
    surface: 40,
    rent: 680,
    charges: 70,
    furnished: true,
    capacity: 2,
    equipment: ['Meublé', 'Wifi inclus', 'Proche campus'],
  }),
]

export function listingsByCity(city: string): Listing[] {
  return LISTINGS.filter((l) => l.city.toLowerCase() === city.toLowerCase())
}

export function getListing(id: string): Listing | undefined {
  return LISTINGS.find((l) => l.id === id)
}
