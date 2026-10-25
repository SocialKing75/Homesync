# Branchement du backend HomeSync

## État inspecté

Aucun contrat HTTP, client API, URL de backend ni authentification connectée n’est présent dans le projet. Aucun endpoint existant n’a été changé et aucun serveur n’a été ajouté. Les formats ci-dessous sont les **interfaces attendues par le frontend**, à adapter aux contrats réels du backend après leur transmission. Ils ne prescrivent ni routes HTTP ni architecture serveur.

Point d’entrée : `src/services/index.ts`. Il sélectionne actuellement `demoServices`. Les interfaces TypeScript sont dans `src/services/contracts.ts`, les modèles de domaine existants dans `src/types.ts`.

## Frontière des données

| Service | Entrée | Sortie | Usage actuel |
| --- | --- | --- | --- |
| `catalog.list(signal?)` | Signal d’annulation facultatif | `Promise<Listing[]>` | Charge le catalogue et actualise son cache |
| `catalog.getSnapshot()` | Aucune | `Listing[]` | Lecture locale des données déjà chargées, sans requête au rendu |
| `catalog.getById(id)` | Identifiant stable | `Listing \| undefined` | Fiches, favoris, cartes de chat, comparaison et repères |
| `search.reply(request, signal?)` | `ConversationRequest` | `Promise<ConversationResponse>` | Mise à jour de la recherche ou aperçu à confirmer |
| `search.evaluate(criteria)` | `Criteria` | `Results` | Règles Gold/Argent frontend conservées |
| `search.preview(criteria, question)` | Critères + hypothèse | Critères proposés + identifiants ajoutés + résumé | Aperçu local sans modification automatique |
| `messaging.send(thread, draftIndex, signal?)` | Fil annonceur + index du brouillon validé | `Promise<AdvertiserThread>` | Envoi simulé et retour du fil actualisé |

Seul `services/catalog.ts` importe le jeu fictif des logements. Les composants et le moteur de recherche utilisent le catalogue chargé via ce service. Les listes de villes et les trois scénarios sont de la configuration locale, sans appels réseau.

Pour connecter le catalogue, implémenter `CatalogAdapter.list` puis utiliser `createCatalogService(adapter)` et fournir cette même instance à la lecture du catalogue et à l’adaptateur de recherche. Le cache doit être rempli avant de rendre les détails : la liste attend actuellement des logements complets. Si le backend expose une pagination ou un endpoint de détail séparé, l’adaptateur devra hydrater ce cache et déclencher sa mise à jour ; ce comportement n’est pas inventé ici.

Pour le chat, remplacer l’implémentation de `search.reply` par une traduction du contrat réel vers `ConversationResponse`. Les règles `evaluate` et `preview` restent isolées ; une éventuelle reprise côté backend doit garder leur comportement et être validée avec les tests existants.

Les services asynchrones acceptent `AbortSignal`. Une requête annulée doit rejeter avec `name: 'AbortError'`. Les autres échecs rejettent la promesse : le store présente une erreur et conserve les critères, favoris et données déjà chargées. Les réponses de recherche devenues obsolètes sont ignorées.

## Format logement existant

Exemple de la forme attendue, à partir d’une annonce fictive :

```json
{
  "id": "nte1",
  "title": "T3 lumineux — Île de Nantes",
  "city": "Nantes",
  "lat": 47.2112,
  "lng": -1.5599,
  "locationPrecision": "exacte",
  "rooms": 3,
  "surface": 64,
  "rent": 980,
  "charges": 110,
  "furnished": false,
  "capacity": 4,
  "availableFrom": "2026-11-15",
  "photos": ["https://exemple-backend.fr/photos/logement.jpg"],
  "equipment": ["Balcon", "Cuisine équipée", "Ascenseur", "Fibre"],
  "missingInfo": [],
  "advertiser": { "name": "Agence Horizon", "type": "agence", "role": "annonceur" }
}
```

`rent` et `charges` sont des euros **par mois et par logement**, `surface` en m². `charges: null` signifie « À confirmer », jamais zéro. Dates au format ISO `YYYY-MM-DD`. Latitude et longitude en degrés WGS84 ; les points GeoJSON sont construits en ordre `[lng, lat]`. Identifiants stables et uniques nécessaires à la sélection carte/fiches/favoris.

`locationPrecision` vaut `exacte`, `quartier` ou `approximative`. Un annonceur est une `agence` ou un `propriétaire`, rôle `annonceur` ; cela ne définit pas le profil société demandeur. Aucun temps de trajet n’est déduit des coordonnées.

Les champs numériques/booléens non nullables et `availableFrom` suivent le modèle frontend existant. Si le backend peut ne pas les connaître, transmettre ses règles et son schéma pour convenir d’un adaptateur explicite : ne pas inventer de prix, de date ou de caractéristique. Les inconnues déjà prévues sont représentées par `charges: null`, `missingInfo`, les informations de projet `toConfirm` et la précision de localisation.

## Conversation et résultats

`ConversationRequest` contient :

- `text: string` : message envoyé ;
- `senderId: string` : participant de la conversation ;
- `criteria: Criteria` : critères courants ;
- `history: Message[]` : historique du projet, message utilisateur courant inclus.

Les critères existants distinguent `budgetBasis: 'global' | 'par-logement' | null`, les villes, le minimum de pièces, le meublé, les préférences, le nombre de logements, les personnes, la durée et les dates. Les valeurs inconnues restent `null` ou sont détaillées dans `toConfirm`.

Deux réponses frontend possibles :

```ts
type ConversationResponse =
  | {
      kind: 'results'
      criteria: Criteria
      results: Results
      reply: { text: string; change?: string; cards?: ChatCard[]; suggestions: string[] }
      compareCities?: string[]
    }
  | {
      kind: 'preview'
      preview: { question: string; extraListingIds: string[]; summary: string }
    }
```

`Results` conserve les groupes `included`, `gold`, `silver`, `confirm` et les explications par identifiant dans `evaluations`. Le backend peut renvoyer seulement les critères extraits et le texte assistant si l’adaptateur recalcule `Results` avec `search.evaluate`. Il ne faut pas retourner de classement contradictoire avec les raisons affichées.

Un aperçu ne modifie rien avant « Appliquer ». Le moteur simulé actuel est un analyseur de mots-clés ; aucun appel OpenAI n’a été ajouté. Les suggestions de la démonstration correspondent à des phrases effectivement prises en charge.

## Favoris, participants et messages

Les favoris restent dans l’état frontend sous la forme `Record<listingId, participantId[]>`. Les participants suivent `Participant` dans `src/types.ts`. Le fil annonceur suit :

```ts
interface AdvertiserThread {
  listingId: string
  messages: {
    from: 'me' | 'advertiser' | 'draft'
    text: string
    participantId?: string
  }[]
}
```

Les brouillons nécessitent une validation explicite avant envoi. Les fils sont conservés en mémoire lorsqu’on ferme puis rouvre la messagerie. Invitations, lien de démonstration et réponses d’annonceurs ne contactent aucun tiers. Rien n’est conservé après rechargement de la page.

## À transmettre par le coéquipier backend

1. URL d’environnement et contrat OpenAPI ou exemples réels : catalogue, détail, recherche/conversation, erreurs et éventuelle pagination.
2. Règles d’identité/session existantes, identifiants du projet et des participants, mécanisme d’accès et configuration CORS. Le frontend n’ajoute pas sa propre authentification.
3. Formats et opérations de lecture/écriture des favoris, des participants/invitations et des fils annonceurs ; règles de concurrence et d’idempotence des envois.
4. Signification des valeurs absentes, précision géographique, devise, charges, dates, disponibilité et droits d’utilisation des photos.
5. Décision sur l’endroit où sont évaluées les règles Gold/Argent, avec les mêmes seuils et explications. Aucun score ou trajet fictif ne doit les remplacer.

Lorsque le service réel est validé, sélectionner l’adaptateur au point d’entrée unique et actualiser le libellé du mode. Ne pas retirer la mention démonstration tant que des échanges ou données restent simulés.
