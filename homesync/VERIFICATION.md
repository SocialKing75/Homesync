# Vérification — 25 octobre 2026

- Architecture inspectée et conservée : application React/TypeScript/Vite existante.
- Compilation TypeScript et bundle de production réussis. Vite signale un bundle supérieur à 500 ko, principalement lié à la carte ; optimisation de chargement à envisager avant production.
- Trois tests automatisés de recherche réussis (`tests/search.spec.ts`).
- Parcours Chrome sans fenêtre vérifiés à 1440 × 1000 et 390 × 844, avec vrais appels au fond OpenFreeMap, sans interception des réponses réseau.
- Dernier rapport UI : **aucune erreur JavaScript, console ou HTTP relevée**.
- Vue France : neuf clusters, emprise incluant Corse et métropole.
- Carte vers fiche, fiche vers carte, repère sélectionné, ajout de favori, ouverture des favoris et retour à la fiche vérifiés.
- Scénarios simulés : Nantes 4 → 4 → 1 résultat ; Lille 6 → 4 → 0 ; Lyon 1 → 0 → aperçu sans application automatique.
- Raccourci La Réunion, message explicite sans annonces et retour France vérifiés.
- Mobile : absence de débordement horizontal, ouverture de la conversation, envoi d'une recherche et ouverture d'une fiche depuis le chat vérifiés.
- Captures desktop et mobile inspectées visuellement : `artifacts/desktop-france.png`, `desktop-nantes.png`, `mobile-map.png`, `mobile-chat.png`, `mobile-listing.png`.

Corrections issues de la vérification : repères détaillés indépendants du chargement du fond, actualisation des favoris, cadrage Corse, largeur de fiche mobile, sortie de l'état de chargement après un aperçu, suppression d'un aperçu obsolète après une nouvelle recherche, budget strict même avec charges inconnues, suppression des trajets fictifs, police GeoJSON compatible avec OpenFreeMap et favicon.

Limites : maquette jointe inaccessible, contrôles mobiles effectués dans un viewport Chrome et non sur un appareil physique, authentification et API OpenAI non intégrées. Les données et conversations sont de démonstration, conservées en mémoire. Invitation et messagerie ne communiquent avec aucun tiers réel.
