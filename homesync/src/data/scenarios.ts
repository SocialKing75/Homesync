// Parcours déterministes : aucune API OpenAI appelée.
export const SCENARIOS = [
  { name: '1 · À deux à Nantes', profile: 'particulier' as const, messages: ['Un T3 à Nantes, budget maximum 1 200 €', 'Avec balcon', 'Budget maximum 1 050 €'] },
  { name: '2 · Mobilité professionnelle', profile: 'societe' as const, messages: ['Trois logements meublés à Lille pour six collaborateurs pendant quatre mois, budget maximum 1 300 € par logement', 'Budget maximum 1 000 € par logement', 'Budget maximum 200 € par logement'] },
  { name: '3 · Explorer Lyon', profile: 'particulier' as const, messages: ['Un T2 à Lyon, budget maximum 1 200 €', 'Budget maximum 900 €', 'Et si on augmentait le budget ?'] },
]
