# Démonstration frontend HomeSync

Lancer `npm.cmd run dev -- --host 127.0.0.1` dans le dossier `homesync`, puis ouvrir l’URL donnée par Vite. La recherche et les annonces sont fictives, sans appel au backend ni à OpenAI.

## Parcours principal

1. Choisir **Commencer ma recherche**. Sur mobile, ouvrir la conversation.
2. Envoyer **Un T3 à Nantes budget maximum 1200 €** : quatre résultats, dont un Gold, deux Argent et un à confirmer. La carte affiche les mêmes logements.
3. Cliquer **Voir la fiche** sur une carte de chat ou toucher un repère de prix. Examiner le loyer, les charges, la disponibilité fictive, les équipements et les raisons du classement.
4. Ajouter un **Favori**, fermer la fiche, ouvrir **Favoris** : le logement y figure. Le rouvrir depuis cette liste sélectionne le même repère.
5. Envoyer **Budget maximum 1050 €** : un seul résultat subsiste. Une modification de budget ne recentre pas une carte explorée manuellement.

## Société

Repartir de l’écran de profils, choisir **Loger mon équipe**, puis envoyer **Trois logements meublés à Lille pour six collaborateurs pendant quatre mois, budget maximum 1300 € par logement**. Six logements fictifs sont proposés. Le résumé distingue logements, personnes et durée ; les dates restent à confirmer. La société est demandeuse de logements, pas agence annonceuse.

## Autres éléments déjà présents

- Les trois conversations simulées sont rejouables depuis le chat ; leurs boutons de démarrage réinitialisent volontairement le projet de démonstration.
- « Et si on augmentait le budget ? » crée un aperçu à **Appliquer** ou **Annuler**.
- Les boutons **Comparer** et **Analyses** s’appuient exclusivement sur le catalogue chargé et sur les favoris du projet.
- Une question ou une demande de visite prépare un brouillon. **Valider et envoyer** ne fait qu’un échange simulé ; le fil est conservé lorsqu’on le ferme et le rouvre.
- Les raccourcis ultramarins conservent le fond interactif et indiquent l’absence d’annonces fictives. « Vue France » recadre la métropole et la Corse.

## Vérifier

```powershell
npm.cmd run build
npx.cmd playwright test tests/search.spec.ts tests/analytics.spec.ts tests/services.spec.ts tests/profile-choice.spec.ts tests/demo-flow.spec.ts tests/frontend.spec.ts --workers=1
```

Le serveur Vite doit être démarré pour les tests navigateur, et Chrome installé au chemin indiqué dans les tests. `HOMESYNC_URL` permet de choisir un autre port. Les captures sont dans `artifacts/`. Les viewports de téléphone ne remplacent pas une vérification sur un appareil physique.

Le branchement futur est décrit dans [BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md). Aucune route serveur n’est inventée par le frontend.
