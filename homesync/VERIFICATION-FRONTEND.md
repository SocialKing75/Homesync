# Refonte du frontend — 25 octobre 2026

## Réalisation

Stack React/TypeScript/Vite, catalogue, moteur de recherche simulé et MapLibre/OpenFreeMap conservés. Aucun backend, contrat d’API externe ou mécanisme d’authentification ajouté.

- Nouvelle palette centralisée marine/crème/cuivre ; cuivre foncé pour les petits textes. Roboto Condensed, Lato et Hind chargés avec des polices de remplacement.
- Navigation Recherche, Favoris, Messages, Analyses ; profils particulier et société ; invitations locales conservées et identifiées comme démonstration.
- Carte majoritaire, conversation latérale, panneau d’annonces dépliable. Une même instance de carte est conservée entre les vues et les formats desktop/mobile.
- Priorité des repères : sélection, favoris, puis identifiant stable. Masquage des collisions sans supprimer les annonces du panneau. Sélection marine et contour cuivre.
- Modification du budget sans recentrage ; une exploration commencée pendant une réponse est protégée contre le recentrage automatique. Commandes explicites de navigation conservées.
- Galerie avec précédent/suivant et remise à zéro à chaque logement ; description structurée issue des données ; actions question et visite distinctes ; informations inconnues à confirmer.
- Analyses calculées sur les résultats chargés ou, avant recherche, sur le catalogue explicitement nommé : nombre, fourchette de loyers CC connus, répartition par pièces, correspondance et comparaison des favoris.
- Chat en mode démonstration, participants identifiés et micro désactivé explicitement. Aperçu « Et si… ? » avec Appliquer/Annuler.
- Panneau mobile dépliable, navigation basse, ajustement à la hauteur du viewport visuel, saisie à 16 px sur mobile et réduction des éléments secondaires en faible hauteur.

## Contrôles

- `npm.cmd run build` : types et compilation de production réussis. Avertissement Vite conservé sur la taille du bundle cartographique, environ 1,07 Mo avant compression.
- Tests existants de recherche : 3 réussis.
- Tests des analyses : 2 réussis, notamment exclusion des charges inconnues des totaux et gestion des résultats vides.
- Test navigateur de refonte : annonces, galerie, favoris, analyses, même carte après changement de vue et de viewport, absence de recentrage après changement de budget, absence de collision entre les repères affichés, fiche mobile stable, absence de débordement horizontal.
- Contrastes calculés : marine/blanc, texte/blanc, texte secondaire/crème et cuivre foncé/crème supérieurs ou égaux à 4,5:1.
- Parcours UI existant complet desktop/mobile : aucune erreur JavaScript, console ou HTTP dans `artifacts/ui-results.json`.
- Captures inspectées : `refonte-desktop.png`, `refonte-analyses.png`, `refonte-mobile-chat.png`, `refonte-mobile-fiche.png`, `refonte-mobile-analyses.png` dans `artifacts/`.

## Limites

Les captures de référence annoncées n’étaient pas présentes dans les pièces jointes accessibles ; les instructions textuelles ont servi de référence. Les données, échanges et invitations restent simulés et conservés en mémoire. Cartes, polices et illustrations utilisent le réseau. Le contrôle mobile utilise Chrome avec des viewports de téléphone, dont une hauteur réduite ; il ne remplace pas un contrôle sur téléphone physique et clavier natif.
