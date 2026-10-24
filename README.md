[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/JY1xUUGg)

# ToulonFind AI — Trouver le bon bien au bon prix

Application de recherche immobilière assistée par IA : un assistant conversationnel comprend la demande, filtre les annonces de toute la France par recherche sémantique (RAG), calcule un score de compatibilité pour chaque bien, puis l'utilisateur découvre les annonces en mode swipe, les like et postule avec un dossier de financement complet.

## Fonctionnalités

| | |
|---|---|
| **Assistant de recherche** | Chat sur la page d'accueil : demande la ville (3 max), le type et le budget, comprend le texte libre (quartier, surface, terrasse…), dictée vocale. Garde-fous : insultes, détournement, hors sujet, coordonnées masquées, anti-spam. |
| **RAG** | Annonces vectorisées (sentence-transformers + ChromaDB), recherche sémantique puis filtres stricts, assouplissement automatique si rien ne correspond. |
| **Matching** | Score /100 détaillé par critère : budget, type & pièces, envies (ressemblance au texte + équipements), localisation, surface, prix au m² vs médiane de la ville. Les likes gold affinent les goûts. |
| **Swipe** | Cartes photo façon Tinder : droite = like, gauche = dislike (l'annonce ne revient plus), ★ = like gold, glisser vers le haut = fiche complète et détail du match. |
| **Comptes** | Inscription avec vérification par email, connexion, mot de passe oublié, suppression du compte. Mots de passe scrypt, données personnelles chiffrées, verrouillage après 5 échecs. |
| **Coups de cœur & candidature** | Onglet du dashboard : annonces likées, fiche avec photos, candidature. Dossier de pièces selon le profil (particulier / société), dépôt chiffré, export « dossier prêt » pour la banque. |
| **Automatisation** | Scraping BienIci quotidien (7 h) de 20 villes, alertes email / Slack sur les nouvelles annonces correspondant à un profil. |
| **Analyses** | Dashboard historique : statistiques de marché, k-NN des biens sous-évalués, régression, rapport PDF, médianes DVF par quartier (Toulon). |

## Architecture

```
.
├── backend/
│   ├── api/main.py            FastAPI : routes historiques + branchement des modules
│   ├── auth/                  comptes, sessions, chiffrement, likes / dislikes (SQLite)
│   ├── chat/                  agent du chatbot (slot filling) + garde-fous
│   ├── rag/                   ChromaDB, assistant LLM local (Ollama)
│   ├── matching/              score de compatibilité /100
│   ├── dossier/               pièces du dossier, dépôt chiffré, candidatures
│   ├── automation/            scraping multi-villes, ingestion planifiée, alertes
│   ├── analysis/              stats, régression, k-NN, scoring, médianes DVF
│   ├── loaders/ models/ services/
├── immo-app-v3/               front React (Vite)
│   └── src/
│       ├── api.js             client API (jeton, upload, téléchargement)
│       ├── components/        ChatAgent, MicButton, CoupsDeCoeur, Dossier, Dashboard…
│       └── pages/             Login (landing), Decouvrir (swipe), VerifierEmail, Accueil (dashboard)…
├── data/                      annonces (CSV), DVF, index ChromaDB, base SQLite (non versionnés)
├── docs/CONTRAT_API.md        contrat d'API pour le front
└── tests/                     tests pytest (back)
```

## Lancer en local

Prérequis : Python 3.11, Node 18+, et [Ollama](https://ollama.com) en option (analyse rédigée de `/api/rag/assistant`).

```bash
pip install -r requirements.txt
cp .env.example .env          # puis remplir (voir Configuration)

# Back (depuis la racine) → http://localhost:5001/docs
python -m uvicorn backend.api.main:app --port 5001 --reload

# Front (depuis immo-app-v3/) → http://localhost:5173
cd immo-app-v3 && npm install
node node_modules/vite/bin/vite.js
```

> Sous Windows, ne pas utiliser `npm run dev` : le `&` du chemin du dossier casse le script npm.

Au premier lancement, le modèle d'embeddings (~90 Mo) est téléchargé et l'index ChromaDB est construit depuis `data/annonces_bienici.csv`.

## Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `APP_SECRET_KEY` | Clé maîtresse de chiffrement (**obligatoire en production**, longue et aléatoire). Sans elle, une clé locale est générée dans `data/.secret_key`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `ALERT_FROM` | Envoi des emails (vérification, mot de passe oublié, alertes). Sans SMTP, les emails sont seulement écrits dans les logs. |
| `FRONTEND_URL` | Base des liens envoyés par email (défaut `http://localhost:5173`). |
| `APP_ENV=dev` | Développement uniquement : sans SMTP, l'API renvoie le lien de vérification (`dev_lien`) pour tester sans boîte mail. |
| `ADMIN_TOKEN` | Active les routes `/api/admin/*` (en-tête `X-Admin-Token`). |
| `SLACK_WEBHOOK_URL` | Alertes Slack (facultatif). |
| `SCRAPING_VILLES` | Villes scrapées, séparées par des virgules (défaut : 20 grandes villes). |
| `OLLAMA_MODEL`, `OLLAMA_BASE_URL` | LLM local de l'assistant (défaut `gemma4:latest`). |
| `CHROMA_PATH`, `APP_DB_PATH` | Emplacements de l'index et de la base (défaut dans `data/`). |
| `VITE_API_URL` (front) | URL de l'API si elle n'est pas sur `http://localhost:5001`. |

## Données

- **Annonces** : 680 annonces BienIci avec photos (20 par ville dans 19 grandes villes, 300 à Toulon). Rafraîchir :
  `python -m backend.automation.export_csv` (remplace le CSV et reconstruit l'index) ; l'ingestion quotidienne ajoute les nouveautés.
- **DVF** : transactions de Toulon (`data/raw/83137_*.csv`, [data.gouv.fr](https://files.data.gouv.fr/geo-dvf/latest/csv/83/)) → médianes par quartier : `python -m backend.analysis.dvf_medianes`.
- Les données personnelles (base SQLite, pièces du dossier, index, clé) restent hors du dépôt (`.gitignore`).

## Tests

```bash
python -m pytest tests -q
```

96 tests : comptes et sécurité, chatbot et garde-fous, RAG, matching, likes / dislikes, dossier et candidatures, analyses.

## API

Le contrat complet pour le front est dans [`docs/CONTRAT_API.md`](docs/CONTRAT_API.md) (conventions, objets, chaque route, parcours, tâches front restantes). Documentation interactive : http://localhost:5001/docs.

## Sécurité & RGPD

- Mots de passe hachés (scrypt), jetons de session aléatoires stockés hachés, verrouillage après 5 échecs, réponses qui ne révèlent pas si un email est inscrit.
- Email et nom chiffrés en base ; pièces du dossier chiffrées sur disque, accessibles à leur seul propriétaire, effacées avec le compte.
- Chatbot : coordonnées masquées avant tout stockage, limites de débit, champ piège anti-robot.
- À décider avant la mise en production : durée de conservation des pièces et mention dans la politique de confidentialité.

## Répartition du travail

| Membre | Rôle | Contributions principales |
|--------|------|--------------------------|
| Melina Barbieux | Data Engineer | Analyse du marché, Scraping, Read Me & Déploiement |
| Brigitte raissa Simen ossanguem | Data Engineer | Analyse du marché, Scraping, Frontend |
| Maxence N'goma | Data Scientist | Scraping, Connexion Scraping & Frontend |
| Marc ivan stevie Nguidjol | AI Engineer | Backend, Connexion Frontend & Backend |
| Joe Deriu | Frontend / DevOps | Frontend & Algorithme |

## Références

- Joel Grus, *Data Science From Scratch*, ch. 5 (statistiques) et ch. 14 (régression)
- Données DVF : [data.gouv.fr](https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/)
