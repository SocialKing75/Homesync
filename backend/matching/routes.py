# =============================================================================
# backend/matching/routes.py — POST /api/matching
# =============================================================================
# Profil de recherche → annonces classées par score de compatibilité (/100),
# détail par critère. Réservé aux comptes vérifiés (les annonces complètes ne
# sont servies qu'aux comptes). Dislikes exclus ; likes gold = goûts pris en
# compte dans la ressemblance sémantique.
# =============================================================================

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.auth.db import connect
from backend.auth.likes import _annonces, disliked_ids
from backend.dossier.routes import compte_verifie
from backend.loaders.annonces_loader import charger_annonces_csv
from backend.matching.scoring import matcher

router = APIRouter(prefix="/api/matching", tags=["matching"])


class ProfilMatchingIn(BaseModel):
    villes: List[str] = Field(default_factory=list, max_length=3)
    type_bien: Optional[Literal["Appartement", "Maison"]] = None
    pieces: Optional[int] = Field(None, ge=1, le=10)
    budget_max: Optional[float] = Field(None, gt=0)
    surface_min: Optional[float] = Field(None, gt=0)
    quartiers: List[str] = Field(default_factory=list)
    texte: str = Field("", max_length=500)      # envies libres : « calme, lumineux, terrasse »
    limite: int = Field(20, ge=1, le=50)


def gouts(user_id: int) -> str:
    """Titres des annonces likées en gold : décrivent ce que l'utilisateur aime."""
    with connect() as conn:
        ids = [r["annonce_id"] for r in conn.execute(
            "SELECT annonce_id FROM likes WHERE user_id = ? AND type = 'gold' ORDER BY created_at DESC LIMIT 5", (user_id,))]
    index = _annonces()
    return " ".join(index[i].get("titre") or "" for i in ids if i in index)


@router.post("")
def matching(profil: ProfilMatchingIn, user=Depends(compte_verifie)) -> list[dict]:
    masquees = disliked_ids(user["id"])
    candidates = [a for a in charger_annonces_csv()
                  if a["id_source"] not in masquees and (not profil.villes or a["ville"] in profil.villes)]
    return matcher(profil.model_dump(), candidates, gouts(user["id"]))[:profil.limite]
