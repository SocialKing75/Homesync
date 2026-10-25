# Vérification du parcours démontrable — 25 octobre 2026

## Résultat

Compilation TypeScript et production réussie. Dix-neuf cas distincts validés : recherche (3), analyses (2), services (4), profils (4), frontend (2), parcours et erreurs de services (4). Les contrôles ayant révélé une ambiguïté de libellé dans le ciblage d’un bouton ou une attente insuffisante du fond cartographique ont été corrigés puis relancés avec succès.

Parcours vérifiés avec de vrais chargements MapLibre/OpenFreeMap sous Chrome :

- Particulier, 1440 × 1000 : sélection du profil, T3 Nantes à 1 200 €, quatre résultats, même logement dans le chat et sur la carte, fiche, favori, réouverture depuis les favoris.
- Société, 390 × 844 : logements meublés à Lille, six collaborateurs, six résultats, fiche et favori, résumé adapté au profil.
- Questions à l’annonceur : brouillon, validation explicite, réponse simulée, fermeture et réouverture sans perte du fil.
- Comparaison mobile : défilement dans le panneau sans débordement de la page. Fermeture Échap, focus conservé dans les modales et retour au contrôle précédent.
- Navigation mobile : un seul onglet actif, retour à la carte et accès au chat ; même instance de carte lors du passage aux analyses.
- Service indisponible simulé : erreur lisible, résultats et favoris conservés, recherche suivante réussie.
- Réponse tardive simulée après changement de profil : réponse ignorée, profil et projet préservés.
- Carte non recentrée par un simple changement de budget ; règles Gold/Argent inchangées.
- Profils : cartes égales sur desktop, empilées sur mobile, clavier, retour de sélection, mouvement réduit, remplacement des images indisponibles et conservation des saisies.
- Palette et contrastes déjà définis conservés ; fonds et détails de couleur historiques harmonisés. Les couleurs Gold/Argent restent fonctionnelles.

Aucune erreur JavaScript ou console sur les deux parcours nominaux complets. Les tests d’échec provoquent volontairement une indisponibilité de service ou d’image et vérifient leur prise en charge.

## Captures inspectées

`artifacts/demo-1440-carte.png`, `demo-390-messages.png`, `demo-390-comparaison.png`, ainsi que les captures de profils, du chat et des analyses produites par les tests frontend. Les tests mobile incluent aussi une hauteur réduite de 480 px ; aucun téléphone physique n’a été utilisé.

## Limites restantes

Catalogue, recherche, réponses d’annonceurs, invitations et stockage du projet restent de démonstration. Les services typés isolent ces implémentations ; aucun endpoint ou système d’authentification serveur n’a été inventé. La persistance est en mémoire et disparaît au rechargement. Le bundle cartographique déclenche toujours l’avertissement Vite sur la taille d’un chunk, environ 1,07 Mo avant compression ; aucune erreur de compilation.

Guide : [DEMONSTRATION.md](DEMONSTRATION.md). Formats et responsabilités de branchement : [BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md).
