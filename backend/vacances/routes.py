# =============================================================================
# backend/vacances/routes.py — GET /api/vacances
# =============================================================================
# Informations publiques du catalogue de locations de vacances : destinations
# (et communes), nombre d'annonces, période des données et texte d'attribution
# Inside Airbnb (licence CC BY 4.0) à afficher dans l'interface.
# Les annonces elles-mêmes passent par le chat (POST /api/chat, profil=holiday)
# puis GET /api/chat/resultats/{id} (compte vérifié).
# =============================================================================

from typing import Optional

from fastapi import APIRouter

from backend.vacances import catalogue

router = APIRouter(prefix="/api/vacances", tags=["vacances"])


@router.get("")
def infos(lang: Optional[str] = None) -> dict:
    return catalogue.infos("en" if (lang or "").lower().startswith("en") else "fr")
