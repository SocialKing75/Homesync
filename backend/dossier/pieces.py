# =============================================================================
# backend/dossier/pieces.py — Pièces à fournir selon le profil de l'acheteur
# =============================================================================
# `nombre`        : fichiers attendus pour que la pièce soit complète
# `obligatoire`   : nécessaire pour postuler (sinon pièce facultative)
# `validite_jours`: ancienneté maximale du document (date saisie au dépôt)
# =============================================================================

PIECES = {
    "particulier": [
        {"id": "identite", "label": "Carte d'identité", "obligatoire": True, "nombre": 1},
        {"id": "bulletins_salaire", "label": "3 derniers bulletins de salaire", "obligatoire": True, "nombre": 3},
        {"id": "avis_imposition", "label": "Dernier avis d'imposition", "obligatoire": True, "nombre": 1},
        {"id": "rib", "label": "Relevé d'identité bancaire (RIB)", "obligatoire": True, "nombre": 1},
        {"id": "justificatif_apport", "label": "Justificatif d'apport (si vous en avez un)", "obligatoire": False, "nombre": 1},
    ],
    "societe": [
        {"id": "kbis", "label": "Extrait Kbis de moins de 3 mois", "obligatoire": True, "nombre": 1, "validite_jours": 90},
        {"id": "comptes_annuels", "label": "Comptes annuels", "obligatoire": True, "nombre": 1},
        {"id": "bilan", "label": "Bilan", "obligatoire": True, "nombre": 1},
        {"id": "identite_dirigeant", "label": "Pièce d'identité du dirigeant", "obligatoire": True, "nombre": 1},
    ],
}

PROFILS = {"particulier": "Particulier", "societe": "Société"}


def piece(profil: str, piece_id: str) -> dict | None:
    return next((p for p in PIECES.get(profil, []) if p["id"] == piece_id), None)
