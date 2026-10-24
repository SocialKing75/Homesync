# Contrat d'API — Back FastAPI

Document de référence pour le front. Toute route listée ici est implémentée et couverte par les tests (`python -m pytest tests`).
La documentation interactive générée par FastAPI reste disponible sur **http://localhost:5001/docs** (schémas exacts, essai en direct).

---

## 1. Conventions

| Sujet | Règle |
|---|---|
| URL de base | `http://localhost:5001` en local. Côté front : `API_BASE` dans `src/api.js` (surcharge : variable Vite `VITE_API_URL`). |
| Format | JSON en entrée et en sortie (`Content-Type: application/json`), sauf dépôt de fichier (multipart) et téléchargements (fichier binaire). |
| Authentification | En-tête `Authorization: Bearer <access_token>` (jeton reçu au login, valable 7 jours). Utiliser `api()` de `src/api.js` qui l'ajoute tout seul. |
| Compte vérifié | Routes marquées 🔐✉ : compte connecté **et** email vérifié, sinon `403 "Adresse email non vérifiée."`. |
| Erreurs | Corps `{"detail": "message lisible en français"}`. Exception : `POST /api/candidatures` renvoie `{"detail": {"message", "manquantes": [...]}}`. Validation (422) : `{"detail": [{"msg", ...}]}`. Utiliser `errorText(data)` de `src/api.js` qui gère les trois cas. |
| Session expirée | `401` sur une route 🔐 → `api()` efface le jeton ; renvoyer l'utilisateur vers la connexion. |
| Dates | ISO 8601 UTC (`2026-10-25T09:12:00+00:00`). |

Légende : 🌐 public · 🔐 connecté · 🔐✉ connecté + email vérifié · 🛠 admin (en-tête `X-Admin-Token`).

---

## 2. Objet « annonce »

Les annonces scrapées (toute la France) ont toutes cette forme. Champ `id_source` = identifiant à utiliser dans les routes likes, dislikes, candidatures.

```json
{
  "id_source": "hosman-12345",
  "url_source": "https://www.bienici.com/annonce/hosman-12345",
  "titre": "Appartement 2 pièces de 46 m² - Lumineux dernier étage",
  "type": "Appartement T2",
  "surface": 46.0,
  "prix": 249000.0,
  "quartier": "Saint-Pierre",
  "ville": "Bordeaux",
  "code_postal": "33000",
  "description": "Texte complet sans HTML…",
  "nb_pieces": 2,
  "dpe": "D",
  "photos": ["https://file.bienici.com/photo/…jpg", "…"],
  "photos_count": 15,
  "lat": 44.84, "lon": -0.57,
  "jardin": false, "piscine": false, "terrasse": true,
  "date_scraping": "2026-10-24"
}
```

Dans les listes de likes / candidatures, l'annonce est résumée dans `annonce` :
`{prix, surface, quartier, type_bien, source, url, titre, ville, code_postal, photos, description, nb_pieces, dpe, jardin, terrasse, piscine}`.
`source` vaut `"annonces"` (annonce scrapée, clé = `id_source`) ou `"properties"` (bien du dashboard historique, clé = son `id` numérique en texte, sans photos ni ville).

---

## 3. Comptes — `/api/auth`

| Méthode | Route | Accès | Corps | Réponse |
|---|---|---|---|---|
| POST | `/api/auth/register` | 🌐 | `{email, password, nom?}` | `202 {message}` (+ `dev_lien` en mode dev) |
| POST | `/api/auth/verify-email` | 🌐 | `{token}` | `200 {message}` · `400` lien invalide/expiré |
| POST | `/api/auth/resend-verification` | 🌐 | `{email}` | `202 {message}` |
| POST | `/api/auth/login` | 🌐 | `{email, password}` | `200 {access_token, token_type, expires_at, user}` |
| POST | `/api/auth/logout` | 🔐 | — | `200 {message}` |
| POST | `/api/auth/logout-all` | 🔐 | — | `200 {message}` (tous les appareils) |
| GET | `/api/auth/me` | 🔐 | — | `200 {id, email, nom, email_verifie, cree_le}` |
| POST | `/api/auth/change-password` | 🔐 | `{current_password, new_password}` | `200 {message}` (les autres sessions sont fermées) |
| POST | `/api/auth/forgot-password` | 🌐 | `{email}` | `202 {message}` |
| POST | `/api/auth/reset-password` | 🌐 | `{token, new_password}` | `200 {message}` · `400` lien invalide/expiré |
| DELETE | `/api/auth/me` | 🔐 | `{password}` | `200 {message}` — efface compte, likes, dossier et pièces |

Règles à refléter dans l'UI :
- **Mot de passe** : 10 à 128 caractères, une minuscule, une majuscule, un chiffre (sinon `422`).
- **Login** : `401` identifiants faux · `403` email non vérifié (proposer « Renvoyer l'email ») · `423` compte verrouillé 15 min après 5 échecs.
- **Réponses volontairement identiques** (`register`, `resend-verification`, `forgot-password`) que l'adresse existe ou non : afficher toujours le même message, ne jamais déduire si un compte existe.
- **Liens des emails** (à servir par le front) : `/verifier-email?token=…` (page faite) et `/reinitialiser-mot-de-passe?token=…` (**page à faire**).
- **Mode dev** : avec `APP_ENV=dev` et sans SMTP, `register`/`resend-verification` renvoient `dev_lien` (lien de vérification) pour tester sans boîte mail.

---

## 4. Chatbot de la landing — `/api/chat`

### `POST /api/chat` 🌐 (si un jeton est envoyé, les dislikes sont exclus et le message s'adapte)

Entrée :
```json
{ "message": "T3 à Lyon, 300k", "sessionId": "uuid-généré-par-le-front", "honeypot": "", "formTs": 1792878626662 }
```
- `sessionId` : identifiant de conversation (UUID côté front, conservé en `localStorage`). Absent → le back en crée un et le renvoie.
- `honeypot` : champ caché du formulaire, doit rester vide. `formTs` : `Date.now()` à l'affichage du formulaire (envoi < 2 s = bot → réponse neutre).
- `message` : 1 000 caractères maximum.

Sortie :
```json
{
  "reply": "texte de l'agent",
  "slots": { "villes": ["Lyon"], "type_bien": "Appartement", "pieces": 3, "budget_max": 300000, "quartiers": [], "surface_min": 65, "objectif": "investissement" },
  "missing": ["budget"],
  "complete": false,
  "suggestions": ["200 000 €", "300 000 €", "450 000 €", "Peu importe"],
  "choix": { "type": "villes", "options": ["Toulon", "Paris", "…"], "max": 3 },
  "resultats": { "search_id": "…", "count": 30, "prix_min": 120000, "prix_max": 428900,
                 "items": [{ "type": "Appartement T2", "ville": "Bordeaux", "quartier": "Saint-Pierre", "surface": 46 }] },
  "require_account": true,
  "sessionId": "…"
}
```
- **Ordre des questions** : villes (obligatoire, 3 max) → type → budget. `choix` présent = afficher des puces à sélection multiple (`max` = limite), puis envoyer la sélection jointe par des virgules (`"Lyon, Nantes"`).
- `suggestions` = boutons de réponse rapide (envoyer leur texte tel quel). Exception : `"Affiner ma recherche"` est géré côté front.
- `resultats` présent = recherche terminée. **Aperçu volontairement flou** (ni prix exact, ni lien, ni photo) : `require_account: true` → proposer la création de compte ; `false` (déjà connecté) → bouton vers le swipe.
- **Garde-fous** (réponse `200` avec un `reply` de refus, `slots` inchangés) : insultes, tentative de détournement, hors sujet, plus de 40 messages par conversation. Les coordonnées (email, téléphone, IBAN, carte) sont masquées et un avertissement est ajouté au `reply`.
- Erreurs : `400` message vide ou trop long · `429` plus de 30 messages / 5 min par IP.

### `GET /api/chat/resultats/{search_id}` 🔐✉

Paramètre `?a_swiper=true` : retire aussi les annonces déjà likées (pour le swipe). Les dislikes sont toujours retirés.
Réponse : `{search_id, criteres, annonces: [annonce complète + match, …]}` triées par score de matching décroissant (voir § 7 bis) · `404` recherche inconnue.

---

## 5. Likes, likes gold, dislikes

| Méthode | Route | Accès | Corps | Réponse |
|---|---|---|---|---|
| GET | `/api/likes?type=gold` | 🔐 | — | `[{annonce_id, type, cree_le, annonce}]` (filtre `type` facultatif : `classique`/`gold`) |
| GET | `/api/likes/ids` | 🔐 | — | `{"classique": [ids], "gold": [ids]}` — format compact pour la **carte** |
| PUT | `/api/likes/{annonce_id}` | 🔐✉ | `{type?: "classique"\|"gold"}` | `200 {annonce_id, type, cree_le, annonce}` |
| PUT | `/api/likes/{annonce_id}/classique` | 🔐✉ | — | idem |
| PUT | `/api/likes/{annonce_id}/gold` | 🔐✉ | — | idem |
| DELETE | `/api/likes/{annonce_id}` | 🔐 | — | `200` · `404` pas dans les favoris |
| GET | `/api/dislikes` | 🔐 | — | `[{annonce_id, cree_le, annonce}]` |
| GET | `/api/dislikes/ids` | 🔐 | — | `[ids]` |
| PUT | `/api/dislikes/{annonce_id}` | 🔐✉ | — | `200 {message, annonce_id}` |
| DELETE | `/api/dislikes/{annonce_id}` | 🔐 | — | `200` (annonce de nouveau visible) · `404` |

- Une annonce a **au plus une réaction** : liker retire le dislike, disliker retire le like, re-liker change le type.
- `404 "Annonce introuvable."` si l'`annonce_id` n'existe pas.
- Une annonce dislikée disparaît de `/api/properties`, `/api/rag/search` et des résultats du chat pour cet utilisateur.

---

## 6. Dossier de candidature & candidatures

### Pièces attendues selon le profil (`GET /api/dossier` renvoie la checklist)

| Profil | Pièce (`id`) | Obligatoire | Fichiers |
|---|---|---|---|
| Particulier | `identite` — Carte d'identité | oui | 1 |
| | `bulletins_salaire` — 3 derniers bulletins de salaire | oui | 3 |
| | `avis_imposition` — Dernier avis d'imposition | oui | 1 |
| | `rib` — Relevé d'identité bancaire | oui | 1 |
| | `justificatif_apport` — Justificatif d'apport | non | 1 |
| Société | `kbis` — Extrait Kbis de moins de 3 mois | oui (**date du document requise**) | 1 |
| | `comptes_annuels` — Comptes annuels | oui | 1 |
| | `bilan` — Bilan | oui | 1 |
| | `identite_dirigeant` — Pièce d'identité du dirigeant | oui | 1 |

### Routes (toutes 🔐✉)

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/api/dossier` | — | état du dossier (ci-dessous) |
| PUT | `/api/dossier/profil` | `{profil: "particulier"\|"societe"}` | état du dossier |
| POST | `/api/dossier/documents` | **multipart** : `piece` (id), `fichier`, `date_document?` (`AAAA-MM-JJ`) | `201` état du dossier |
| GET | `/api/dossier/documents/{doc_id}` | — | le fichier (pièce jointe) |
| DELETE | `/api/dossier/documents/{doc_id}` | — | état du dossier |
| GET | `/api/dossier/export` | — | ZIP « dossier prêt pour la banque » (`00_recapitulatif.txt` + pièces numérotées) |
| DELETE | `/api/dossier` | — | `{message}` (efface profil et toutes les pièces) |
| GET | `/api/candidatures` | — | `[{annonce_id, statut, profil, envoyee_le, annonce}]` |
| POST | `/api/candidatures` | `{annonce_id}` | `201 {message, annonce_id, statut}` |
| DELETE | `/api/candidatures/{annonce_id}` | — | `200 {message}` · `404` |

État du dossier :
```json
{
  "profil": "particulier", "profil_label": "Particulier",
  "pieces": [
    { "id": "bulletins_salaire", "label": "3 derniers bulletins de salaire", "obligatoire": true, "nombre": 3,
      "complete": false,
      "documents": [{ "id": "…", "nom": "bulletin_sept.pdf", "mime": "application/pdf", "taille": 182044,
                      "date_document": null, "depose_le": "…" }] }
  ],
  "manquantes": ["3 derniers bulletins de salaire"],
  "complet": false
}
```

Règles du dépôt :
- Formats **PDF, JPEG, PNG** (contrôlés sur le contenu, pas sur l'extension) → sinon `415`. **10 Mo** max → `413`.
- Pièce à 1 fichier : un nouveau dépôt **remplace** l'ancien. Bulletins : 3 max → `409` au 4ᵉ (en supprimer un d'abord).
- Kbis : `date_document` obligatoire et de moins de 90 jours → sinon `422`.
- Profil non choisi → `400`. Pièce d'un autre profil → `400`.
- Téléchargement : passer par `apiDownload(path, nom)` de `src/api.js` (le jeton est requis, un simple `<a href>` ne marche pas).

Candidatures :
- `POST` exige un **dossier complet** : sinon `400 {"detail": {"message": "Votre dossier est incomplet.", "manquantes": [...]}}` → afficher le composant `Dossier` pour compléter sur place.
- `409` déjà postulé · `404` annonce inconnue.
- La candidature est **enregistrée** (statut `envoyee`) ; aucune transmission à l'agence n'est faite pour l'instant.

Sécurité (déjà assurée par le back, à rappeler dans l'UI) : fichiers chiffrés, visibles par leur seul propriétaire, supprimables, effacés avec le compte.

---

## 7. Recherche sémantique & alertes

| Méthode | Route | Accès | Corps | Réponse |
|---|---|---|---|---|
| POST | `/api/rag/search` | 🌐 (dislikes exclus si connecté) | `{question, n?: 1-50}` | `[annonce + distance]` triées par proximité — **sans `photos`**, et `description` = texte indexé (titre, type, lieu, description). Pour l'annonce complète, préférer le chat (`/api/chat/resultats`). |
| POST | `/api/rag/assistant` | 🌐 | `{question, n?}` | `{query, criteres, biens, reponse, moteur}` — analyse rédigée par le LLM local (lent : jusqu'à ~2 min) ou par règles si le LLM est indisponible (`moteur: "regles"`) |
| POST | `/api/alertes` | 🔐✉ | `{budget_max?, surface_min?, quartiers?}` | `{status, email}` — alertes envoyées à l'email du compte |

---

## 7 bis. Matching demande ↔ annonce

### `POST /api/matching` 🔐✉

```json
{ "villes": ["Lyon", "Nantes"], "type_bien": "Appartement", "pieces": 3, "budget_max": 300000,
  "surface_min": 60, "quartiers": [], "texte": "calme, lumineux, avec terrasse", "limite": 20 }
```
Tous les champs sont facultatifs. `villes` : 3 max (filtre strict) · `type_bien` : `"Appartement"` ou `"Maison"` · `texte` : 500 caractères max · `limite` : 1 à 50 (défaut 20).
Réponse : `[annonce complète + match]` triées par score décroissant. Dislikes exclus.

### Objet `match` (aussi présent dans `GET /api/chat/resultats/{id}`)

```json
{
  "score": 86,
  "detail": [
    { "critere": "budget",       "points": 25,   "max": 25, "explication": "270 000 €, dans le budget (400 000 €)" },
    { "critere": "type",         "points": 20,   "max": 20, "explication": "Appartement T3 — souhaité : Appartement T3" },
    { "critere": "envies",       "points": 13.3, "max": 20, "explication": "Ressemblance avec votre description : 52% (comparée aux autres annonces) · terrasse ✗" },
    { "critere": "localisation", "points": 15,   "max": 15, "explication": "Marseille · Vieille Chapelle" },
    { "critere": "surface",      "points": 10,   "max": 10, "explication": "74 m²" },
    { "critere": "marche",       "points": 9,    "max": 10, "explication": "3 671 €/m², 11% sous la médiane de Marseille" }
  ]
}
```

| Critère | Max | Calcul |
|---|---|---|
| `budget` | 25 | prix ≤ budget : 25 · dégressif jusqu'à +10 % · 0 au-delà |
| `type` | 20 | bon type : 10 · bon nombre de pièces : 10 (±1 pièce : 5) |
| `envies` | 20 | ressemblance sémantique du texte libre, relative aux autres annonces : 14 · équipements demandés présents (jardin, terrasse/balcon, piscine) : 6 |
| `localisation` | 15 | quartier souhaité : 15 · autre quartier : 7 |
| `surface` | 10 | ≥ surface min : 10 · moins de 10 % en dessous : 5 |
| `marche` | 10 | prix au m² ≤ 85 % de la médiane de la ville : 10 · ≥ 115 % : 0 · pas de référence : 5 |

- **Un critère non renseigné donne tous ses points** (il ne pénalise personne).
- Les **likes gold** de l'utilisateur servent de goûts : leurs titres sont ajoutés au texte de la ressemblance.
- Libellés conseillés pour l'UI : Budget, Type & pièces, Vos envies, Localisation, Surface, Prix du marché.

---

## 8. Dashboard historique (inchangé)

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/api/properties` | 🌐 (dislikes exclus si connecté) | biens du dashboard (`id` numérique, `prix`, `prixM2`, `surface`, `type`, `quartier`, `pieces`, `img`…) |
| GET | `/api/stats` | 🌐 | statistiques de marché |
| GET | `/api/market/dashboard` | 🌐 | données agrégées des graphiques |
| POST | `/api/score` | 🌐 | score des biens selon un profil `{pieces, quartiers, prixMax, …}` |
| GET | `/api/knn_opportunities` | 🌐 | top 5 des biens sous-évalués (k-NN) |
| GET | `/api/report/{prop_id}` | 🌐 | rapport PDF d'un bien |
| POST | `/api/predict` | 🌐 | estimation de prix `{surface_m2, rooms, floor, year_built, distance_to_center_km}` |
| GET | `/api/regression` | 🌐 | régression surface → prix |

## 9. Administration 🛠 (`X-Admin-Token: <ADMIN_TOKEN du .env>`, sinon `403`)

`POST /api/admin/sync?dry_run=false` (scraping → CSV → index → alertes, en arrière-plan) · `POST /api/admin/reindex` · `GET /api/admin/status`.
Sans `ADMIN_TOKEN` dans le `.env`, ces routes sont désactivées. Pas d'usage prévu côté front.

---

## 10. Parcours de référence

1. **Landing → compte** : `POST /api/chat` (jusqu'à `resultats`) → `POST /api/auth/register` → email → page `/verifier-email` (`POST /api/auth/verify-email`) → `POST /api/auth/login` → stocker le jeton (`setToken`).
2. **Swipe** : `GET /api/chat/resultats/{id}?a_swiper=true` (déjà triées par `match.score`, badge « X % match ») → à chaque carte `PUT /api/likes/{id}/classique|gold` ou `PUT /api/dislikes/{id}`.
3. **Coups de cœur → candidature** : `GET /api/likes` + `GET /api/candidatures` → fiche → `POST /api/candidatures` → si `400`, `GET /api/dossier`, `PUT /api/dossier/profil`, `POST /api/dossier/documents`… → `POST /api/candidatures`.
4. **Carte** : `GET /api/likes/ids` → marqueur différent pour `classique` et `gold`.

## 11. Côté front : déjà fait / à faire

Déjà fait (à réutiliser, pas à refaire) : `src/api.js` (`api`, `apiUpload`, `apiDownload`, `errorText`, jeton), `ChatAgent` (chat + création de compte), `MicButton` (dictée), `pages/VerifierEmail`, `pages/Decouvrir` (swipe + badge et détail du match), onglet « Coups de cœur » du dashboard (`CoupsDeCoeur` : fiche, candidature) et `Dossier` (checklist + dépôt + export).

À faire, proposition de répartition :

| Dev front 1 — Compte | Dev front 2 — Carte & suivi |
|---|---|
| Page `/reinitialiser-mot-de-passe?token=` (`POST /api/auth/reset-password`) | Marqueurs like / gold sur la carte (`GET /api/likes/ids` ; les annonces scrapées ont `lat`/`lon`) |
| Lien « Mot de passe oublié » + formulaire (`POST /api/auth/forgot-password`) | Liste « Annonces masquées » avec bouton « Rendre visible » (`GET /api/dislikes`, `DELETE /api/dislikes/{id}`) |
| Page « Mon compte » : profil (`GET /api/auth/me`), changement de mot de passe, déconnexion de tous les appareils, suppression du compte | Page ou section « Mes candidatures » détaillée (`GET /api/candidatures`, retrait) |
| Formulaire d'alerte (`POST /api/alertes`) | Gestion du `401` global : redirection vers la connexion quand la session expire |
