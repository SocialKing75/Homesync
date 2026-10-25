# =============================================================================
# backend/auth/likes.py — Favoris : likes classiques et likes gold (/api/likes)
# =============================================================================
# Un utilisateur a au plus un like par annonce, de type "classique" ou "gold"
# (re-liker change le type). Le front s'en sert pour la liste des favoris et
# pour différencier les marqueurs sur la carte.
#
# annonce_id : id d'un bien de /api/properties, id_source d'une annonce RAG, ou
# id d'une location de vacances (« airbnb-… », catalogue backend/vacances).
# =============================================================================

from datetime import datetime, timezone
from functools import lru_cache
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from backend.auth.db import connect
from backend.auth.routes import get_current_user
from backend.loaders.annonces_loader import ANNONCES_CSV, charger_annonces_csv
from backend.services.property_service import PropertyService
from backend.vacances import catalogue as vacances

router = APIRouter(prefix="/api/likes", tags=["likes"])

LikeType = Literal["classique", "gold"]


class LikeIn(BaseModel):
    type: LikeType = "classique"


def _annonces() -> dict[str, dict]:
    """Index annonce_id → résumé (biens du dashboard + annonces RAG).
    Recalculé quand le CSV change (ingestion, export) : sinon les nouvelles
    annonces resteraient « introuvables » (404) jusqu'au redémarrage."""
    return _index_annonces(ANNONCES_CSV.stat().st_mtime_ns if ANNONCES_CSV.exists() else 0)


@lru_cache(maxsize=1)
def _index_annonces(_version: int) -> dict[str, dict]:
    index = {
        str(p.id): {"prix": p.price, "surface": p.surface_m2, "quartier": p.district,
                    "type_bien": p.property_type.capitalize(), "source": "properties"}
        for p in PropertyService().load_properties()
    }
    champs = ("titre", "ville", "code_postal", "photos", "description", "nb_pieces", "dpe", "jardin", "terrasse", "piscine")
    for a in charger_annonces_csv():
        index[a["id_source"]] = {"prix": a["prix"], "surface": a["surface"], "quartier": a["quartier"],
                                 "type_bien": a["type"], "source": "annonces", "url": a["url_source"],
                                 **{c: a.get(c) for c in champs}}
    return index


def _annonce(annonce_id: str) -> Optional[dict]:
    """Résumé d'une annonce likable : bien ou annonce d'achat, ou location de vacances
    (données de l'annonce, prix par nuit : unite_prix = "nuit", source = "Inside Airbnb")."""
    if annonce_id.startswith(vacances.PREFIXE_ID):
        return vacances.resume_favori(annonce_id)
    return _annonces().get(annonce_id)


def _verifie(user, annonce_id: str) -> None:
    """Liker / masquer : compte vérifié et annonce connue."""
    if not user["email_verified"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Adresse email non vérifiée.")
    if _annonce(annonce_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Annonce introuvable.")


def _format(row) -> dict:
    return {"annonce_id": row["annonce_id"], "type": row["type"], "cree_le": row["created_at"],
            "annonce": _annonce(row["annonce_id"])}


@router.get("")
def list_likes(type: Optional[LikeType] = Query(None), user=Depends(get_current_user)) -> list[dict]:
    """Favoris de l'utilisateur, filtrables par type (?type=gold)."""
    sql, params = "SELECT * FROM likes WHERE user_id = ?", [user["id"]]
    if type:
        sql += " AND type = ?"
        params.append(type)
    with connect() as conn:
        rows = conn.execute(sql + " ORDER BY created_at DESC", params).fetchall()
    return [_format(r) for r in rows]


@router.get("/ids")
def like_ids(user=Depends(get_current_user)) -> dict:
    """Format compact pour la carte : {"classique": [ids], "gold": [ids]}."""
    with connect() as conn:
        rows = conn.execute("SELECT annonce_id, type FROM likes WHERE user_id = ?", (user["id"],)).fetchall()
    result = {"classique": [], "gold": []}
    for r in rows:
        result[r["type"]].append(r["annonce_id"])
    return result


@router.put("/{annonce_id}")
def set_like(annonce_id: str, data: LikeIn = LikeIn(), user=Depends(get_current_user)) -> dict:
    """Like classique (par défaut) ou gold ; remplace le type si l'annonce est déjà likée."""
    _verifie(user, annonce_id)
    with connect() as conn:
        conn.execute("DELETE FROM dislikes WHERE user_id = ? AND annonce_id = ?", (user["id"], annonce_id))
        conn.execute(
            "INSERT INTO likes (user_id, annonce_id, type, created_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id, annonce_id) DO UPDATE SET type = excluded.type",
            (user["id"], annonce_id, data.type, datetime.now(timezone.utc).isoformat()),
        )
        row = conn.execute("SELECT * FROM likes WHERE user_id = ? AND annonce_id = ?", (user["id"], annonce_id)).fetchone()
    return _format(row)


@router.put("/{annonce_id}/classique")
def like_classique(annonce_id: str, user=Depends(get_current_user)) -> dict:
    return set_like(annonce_id, LikeIn(type="classique"), user)


@router.put("/{annonce_id}/gold")
def like_gold(annonce_id: str, user=Depends(get_current_user)) -> dict:
    return set_like(annonce_id, LikeIn(type="gold"), user)


@router.delete("/{annonce_id}")
def remove_like(annonce_id: str, user=Depends(get_current_user)) -> dict:
    with connect() as conn:
        cur = conn.execute("DELETE FROM likes WHERE user_id = ? AND annonce_id = ?", (user["id"], annonce_id))
    if cur.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cette annonce n'est pas dans vos favoris.")
    return {"message": "Like retiré.", "annonce_id": annonce_id}


# =============================================================================
# Dislikes (/api/dislikes) : annonces que l'utilisateur ne veut plus recroiser.
# Elles sont retirées de /api/properties, /api/rag/search et des résultats du
# chat dès que l'utilisateur est connecté. Disliker retire le like éventuel.
# =============================================================================

dislikes_router = APIRouter(prefix="/api/dislikes", tags=["likes"])


def disliked_ids(user_id: int) -> set[str]:
    with connect() as conn:
        rows = conn.execute("SELECT annonce_id FROM dislikes WHERE user_id = ?", (user_id,)).fetchall()
    return {r["annonce_id"] for r in rows}


@dislikes_router.get("")
def list_dislikes(user=Depends(get_current_user)) -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM dislikes WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)).fetchall()
    return [{"annonce_id": r["annonce_id"], "cree_le": r["created_at"], "annonce": _annonce(r["annonce_id"])}
            for r in rows]


@dislikes_router.get("/ids")
def dislike_ids(user=Depends(get_current_user)) -> list[str]:
    return sorted(disliked_ids(user["id"]))


@dislikes_router.put("/{annonce_id}")
def set_dislike(annonce_id: str, user=Depends(get_current_user)) -> dict:
    _verifie(user, annonce_id)
    with connect() as conn:
        conn.execute("DELETE FROM likes WHERE user_id = ? AND annonce_id = ?", (user["id"], annonce_id))
        conn.execute("INSERT OR IGNORE INTO dislikes (user_id, annonce_id, created_at) VALUES (?, ?, ?)",
                     (user["id"], annonce_id, datetime.now(timezone.utc).isoformat()))
    return {"message": "Annonce masquée : elle ne vous sera plus proposée.", "annonce_id": annonce_id}


@dislikes_router.delete("/{annonce_id}")
def remove_dislike(annonce_id: str, user=Depends(get_current_user)) -> dict:
    with connect() as conn:
        cur = conn.execute("DELETE FROM dislikes WHERE user_id = ? AND annonce_id = ?", (user["id"], annonce_id))
    if cur.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cette annonce n'est pas masquée.")
    return {"message": "Annonce de nouveau visible.", "annonce_id": annonce_id}
