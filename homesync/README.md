# HomeSync — prototype du hackathon

Projet existant conservé : React 18, TypeScript, Vite, Tailwind CSS, état partagé par Context/reducer, composants par domaine. Aucun appel OpenAI ni authentification réelle.

Parcours prêt à présenter : [DEMONSTRATION.md](DEMONSTRATION.md). Branchement par le coéquipier : [BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md).

Les vues ne lisent plus directement le jeu de logements fictifs : `src/services/index.ts` centralise le catalogue, la recherche et la messagerie. Les contrats sont typés et les requêtes asynchrones sont annulables. Le mode de démonstration reste actif ; aucun endpoint HTTP n’est présumé.

## Lancer

```powershell
cd C:\Users\brigi\Documents\codex\homesync
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

Ouvrir http://127.0.0.1:5173. Choisir Particulier ou Société (demandeuse de logements pour ses collaborateurs, distincte d'une agence annonceuse). Sur PowerShell, `npm.cmd` évite la restriction d'exécution de `npm.ps1`.

```powershell
npm.cmd run build
npm.cmd run preview
npx.cmd playwright test tests/search.spec.ts --workers=1
npx.cmd playwright test tests/analytics.spec.ts tests/frontend.spec.ts --workers=1
npx.cmd playwright test tests/services.spec.ts tests/profile-choice.spec.ts tests/demo-flow.spec.ts --workers=1
node check-ui.mjs
```

Le contrôle UI requiert le serveur de développement lancé et Chrome installé au chemin indiqué dans `check-ui.mjs`. Les captures et le rapport sont dans `artifacts/`.

Les tests `frontend.spec.ts` utilisent Chrome local. Si Vite utilise un autre port, définir `HOMESYNC_URL` avec l’URL affichée par Vite avant de les lancer.

## Refonte du frontend

Identité centralisée dans `src/index.css` : marine `#2D4263`, crème `#FFF5E1`, cuivre `#B87333`, surfaces blanches, texte `#1D2939` et secondaire `#596579`. Le cuivre foncé `#855022` remplace le cuivre de marque pour les petits textes afin de conserver un contraste d’au moins 4,5:1. Les noms historiques de classes Tailwind restent des alias de la nouvelle palette ; Gold et Argent restent fonctionnels et distincts.

Titres en Roboto Condensed, contrôles et navigation en Lato, descriptions et messages en Hind, avec polices de remplacement. La photographie de façade du choix de profil est conservée.

Navigation Recherche / Favoris / Messages / Analyses, panneau d’annonces dépliable, galerie navigable et actions question/visite distinctes. Le chat affiche « Mode démonstration » et le microphone est explicitement indisponible. La même carte reste montée lors des changements de vue et de taille d’écran ; un changement de budget conserve l’exploration. Les repères proches sont masqués selon une priorité sélection puis favoris ; toutes les annonces restent accessibles dans le panneau. Le repère sélectionné est marine avec contour cuivre.

La vue Analyses calcule uniquement le nombre de résultats, la fourchette de loyers CC connus, la répartition par pièces, les favoris et les informations à confirmer du catalogue fictif chargé. Elle n’affiche aucun score, rendement ni statistique de marché non sourcée. Le panneau mobile suit la hauteur du viewport visuel et réduit les éléments secondaires lorsque la hauteur disponible diminue.

## Fonctionnement

- Carte MapLibre GL JS et fond vectoriel OpenFreeMap, zoom et déplacement libres, France et Corse cadrées automatiquement, raccourcis ultramarins et état explicite sans annonces.
- Clusters natifs, repères de prix accessibles au clavier, sélection commune carte/fiches/chat, favoris partagés dans le projet, comparaison de trois logements.
- Chat simulé par analyse locale de mots-clés : ville, T1 à T6, budget mensuel, meublé/non meublé, préférences et besoins société. Les textes non reconnus ne sont pas interprétés par une IA.
- Dans le chat, déplier « Démonstration · 3 conversations simulées ». Choisir un parcours puis cliquer successivement sur « Simuler l’étape ». Chaque parcours réinitialise le projet de démonstration, favoris et participants compris.
- Nantes : T3, 1 200 €, puis balcon, puis 1 050 €. Lille : trois meublés pour six collaborateurs, puis réduction de budget jusqu'à l'état vide. Lyon : T2 à 1 200 €, puis 900 €, puis aperçu d'une hausse du budget, à appliquer explicitement.
- Messagerie annonceur simulée : rédaction de brouillons, validation et réponse de démonstration. Invitation locale d'un participant, sans e-mail ni collaboration réseau. Le lien copié est un exemple de démonstration, sans mécanisme d'accès partagé.
- Desktop : carte à gauche et chat à droite. Mobile : carte, navigation et conversation dépliable. Aucun filtre ni formulaire de recherche.

## Données et règles des zones

Les annonces, disponibilités, prix et équipements sont fictifs. Les photos sont des illustrations et ne représentent pas les logements. Aucun temps de trajet n'est calculé ni annoncé. Les informations manquantes restent « À confirmer ».

Les exigences de ville, nombre minimum de pièces, meublé/non meublé et budget maximal par logement éliminent les annonces incompatibles. Les charges inconnues ne permettent pas de confirmer un budget charges comprises.

- **Gold** : exigences respectées, informations essentielles connues, préférences satisfaites et total mensuel au plus à 90 % du budget individuel s'il est exprimé.
- **Argent** : exigences respectées, mais budget entre 90 et 100 % du plafond ou préférence non satisfaite/à confirmer.
- **À confirmer** : information essentielle manquante ou localisation approximative ; aucun classement Gold/Argent définitif.

Les couches GeoJSON dessinent des rayons indicatifs de 1,15 km autour des annonces classées. Elles expriment une correspondance avec la recherche, pas la qualité d'un quartier, une couverture exhaustive ou une isochrone. La légende explique ces règles. Le budget société global est distinct du budget individuel ; la faisabilité globale peut être examinée en comparant des logements. La durée du bail et la disponibilité définitive restent à confirmer auprès des annonceurs.

Les données restent en mémoire et se réinitialisent au rechargement. Les cartes, polices et photos nécessitent une connexion Internet. Les attributions restent visibles.

Les conversations avec les annonceurs sont conservées en mémoire lors de la fermeture/réouverture de la messagerie. Un changement de profil dans le menu conserve les critères, participants, messages et favoris ; les boutons de démarrage des scénarios simulés réinitialisent volontairement le projet. Une erreur de service conserve les résultats précédents et permet de réessayer le message.

## Documentation officielle consultée

- [MapLibre : clusters GeoJSON](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/)
- [OpenFreeMap : intégration et style Liberty](https://openfreemap.org/quick_start/)

Les captures annoncées dans la demande de refonte n’étaient pas présentes dans les pièces jointes accessibles. L’interface applique les références de structure, couleurs et typographies décrites dans le texte.
