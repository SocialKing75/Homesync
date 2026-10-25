# HomeSync connecté à Trouvelenom

## Choix et périmètre

Branche : `feat/homesync-connected`, créée depuis `origin/main` (`11d7599`) après vérification d'un arbre propre et `git fetch origin --prune`. Aucun changement backend ni contrat API. Pas de push, de fusion ou de réécriture d'historique.

Le frontend retenu est `immo-app-v3` : son client `src/api.js`, son stockage `immo_token`, ses conventions HTTP et sa vérification email sont réutilisés. Adapter le prototype HomeSync locatif aurait nécessité de remplacer son modèle de données et ses calculs de matching. L'identité marine/crème/cuivre et la photographie originale optimisée HomeSync sont reprises dans ce frontend connecté. Les polices existantes sont conservées.

Le parcours public est désormais accueil → chat → compte vérifié → carte/liste → fiche → favoris. Les anciens écrans restent dans le code mais ne sont pas routés : société, collaboration, dossier, rapports et swipe ne sont pas présentés comme disponibles. Les anciennes règles de démonstration ne sont pas appliquées aux résultats réels.

## Lancement

Depuis `immo-app-v3` :

```powershell
npm.cmd ci
$env:VITE_API_URL='http://localhost:5001'
npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Ouvrir http://127.0.0.1:5175. Pour un téléphone physique, utiliser une adresse LAN accessible pour le frontend **et** `VITE_API_URL` : localhost désigne le téléphone.

Le backend suit le README du dépôt et `docs/CONTRAT_API.md` :

```powershell
python -m pip install -r requirements.txt
# L'environnement local testé nécessitait également python-multipart.
python -m pip install python-multipart
$env:APP_ENV='dev'
$env:FRONTEND_URL='http://127.0.0.1:5175'
python -m uvicorn backend.api.main:app --port 5001
```

Sans SMTP en développement, `dev_lien` permet de vérifier l'adresse depuis l'interface. En production, le backend doit envoyer l'email et configurer `FRONTEND_URL`. Il faut servir `/verifier-email` avec le repli SPA côté hébergement. Le client ne crée pas de jeton et ne contourne pas la vérification.

Le premier chargement des embeddings et l'indexation peuvent être longs. Ollama est optionnel pour le repli prévu par le backend. Aucun LLM ou score n'est simulé côté interface connectée.

## Données, session et erreurs

- Le contrat API reste la référence. `src/services/connected.js` centralise les appels utilisés ; `connected.d.ts` décrit leurs formats sans changer les DTO.
- Chat : `sessionId` sauvegardé puis remplacé par l'ID retourné, `honeypot` vide, `formTs` réel, suggestions et choix de villes limités par le serveur. La conversation et la recherche sont conservées sous `homesync_connected`, sans mot de passe.
- `require_account` ouvre le compte ; les détails passent exclusivement par GET authentifié `/api/chat/resultats/{search_id}`. Les aperçus ne deviennent pas de fausses annonces.
- Les prix sont des **prix d'achat**. Les données absentes restent à confirmer. Coordonnées absentes : annonce dans la liste, aucun repère inventé. Les favoris ne fournissant pas de coordonnées ne sont pas artificiellement géolocalisés.
- Le matching et ses explications sont affichés tels que reçus. Un favori sans score n'en reçoit pas un localement. Gold = réaction personnelle, distincte du matching et des zones. Le backend ne fournit aucune zone Gold/Argent : aucune n'est inventée.
- Les routes de favoris sont authentifiées, avec mise à jour seulement après succès et relecture serveur ; les favoris survivent au rechargement. Le changement de type suit l'unicité classique/Gold du contrat.
- 401 : jeton supprimé par le client existant, résultats privés retirés, connexion proposée. 403 : vérification et renvoi du lien proposés. 423, 422, 429 et erreurs métier : messages traités par `errorText`. Une panne ne déclenche aucun jeu de données fictif.
- Inscription/renvoi : message générique du serveur conservé pour ne pas révéler l'existence d'un compte. Aucun jeton ou donnée personnelle n'est journalisé par le nouveau frontend.
- Le prototype `../homesync` reste séparé, en démonstration. Le frontend de ce dépôt est explicitement **connecté** ; ses tests doublent des réponses uniquement dans Playwright, jamais dans l'application livrée.

## Vérifications reproductibles

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:connected
# Backend dev local sans SMTP et dev_lien disponible :
$env:HOMESYNC_REAL_API='1'
npm.cmd run test:connected
```

Playwright est configuré pour Chrome Windows installé ; adapter `executablePath` sur un autre système. Le test réel crée un compte réservé `@example.test`, vérifie l'email en mode dev, teste les favoris puis les retire. Aucun email externe n'est envoyé dans la configuration utilisée.

Les tests contractuels couvrent desktop/mobile, clarification, ID de session serveur, inscription, vérification, connexion, matching, favori Gold, persistance, panne et erreurs 401/403. Ils sont distincts du test navigateur réel et de `node tests/probe-real-backend.mjs` (sonde facultative qui crée un compte et un favori de test). Captures locales dans `test-results/` ignoré par Git.

MapLibre/OpenFreeMap conservent zoom, déplacement, clusters, prix et attributions. Références officielles consultées : [clusters MapLibre](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/) et [OpenFreeMap](https://openfreemap.org/quick_start/). Les tuiles, glyphes, polices et photos nécessitent un accès réseau ; une panne cartographique laisse la liste utilisable. La carte de France ne garantit aucune couverture nationale du catalogue.

## Résultat des vérifications locales

- Compilation et lint complets réussis.
- Six tests Playwright réussis avec `HOMESYNC_REAL_API=1` : les cinq tests contractuels et le parcours navigateur réel. Desktop 1440 × 1000 et mobile 390 × 844 contrôlés visuellement, sans débordement horizontal ni exception JavaScript dans les parcours testés.
- Parcours API réel réussi : inscription 202, vérification 200, connexion 200, profil 200, précision budget 200, recherche 200 (30 annonces), détails 200, favori Gold 200 et relecture confirmée, déconnexion 200.
- Le test navigateur réel vérifie aussi l'ajout, la persistance après rechargement et le retrait d'un favori. Les tests contractuels vérifient le rendu effectif des repères et leur clic ouvrant la même fiche sur desktop/mobile.
- Le worker MapLibre est servi depuis la même origine, compatible avec la CSP du projet. Les libellés utilisent Noto Sans, disponible dans le style OpenFreeMap, pour éviter des requêtes de glyphes 404.
- SMTP non configuré : **envoi d'email réel non validé**. La vérification a utilisé le `dev_lien` du serveur, sans email externe. Le premier chargement de l'index a dépassé 45 secondes ; après initialisation, le parcours complet a réussi. Les avertissements « Expected value to be of type number, but found null instead » proviennent du rendu du fond OpenFreeMap et n'ont pas empêché l'affichage. Aucun token n'est inclus dans les résultats de vérification.

## À fournir pour le hackathon

L'URL du backend accessible depuis les navigateurs, sa configuration d'origine/HTTPS, un catalogue avec coordonnées pour les repères, l'index prêt, et l'envoi des emails avec `FRONTEND_URL` correct. Aucun nouveau contrat n'est demandé. Le poids du bundle MapLibre déclenche un avertissement Vite de taille ; ce n'est pas une erreur de compilation.
