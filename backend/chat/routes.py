# =============================================================================
# backend/chat/routes.py — API du chatbot : /api/chat
# =============================================================================
# POST /api/chat                      message → réponse de l'agent + aperçu des
#                                      annonces trouvées (sans prix exacts, liens ni photos)
# GET  /api/chat/resultats/{id}        annonces complètes (photos…) — compte vérifié requis
#                                      ?a_swiper=true : sans les annonces déjà likées
#
# Garde-fous : voir garde_fous.py (contenu) ; ici, l'anti-spam comme le
# formulaire du site : champ piège `honeypot`, délai minimum entre
# l'affichage du formulaire (`formTs`) et l'envoi, longueur maximale, limite
# de messages par IP.
# =============================================================================

import re
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from backend.auth import crypto
from backend.auth.db import connect
from backend.auth.likes import disliked_ids
from backend.auth.routes import get_current_user, get_optional_user
from backend.chat import agent

router = APIRouter(prefix="/api/chat", tags=["chat"])

MAX_MESSAGE = 1000
RATE_LIMIT_MAX = 30
RATE_LIMIT_WINDOW_S = 5 * 60
_requetes: dict[str, list[float]] = {}  # en mémoire, par instance


class ChatIn(BaseModel):
    message: str
    sessionId: Optional[str] = None
    honeypot: Optional[str] = None
    formTs: Optional[int] = None  # timestamp ms côté navigateur


def _rate_limited(ip: str) -> bool:
    now = time.time()
    for autre in [k for k, v in _requetes.items() if now - v[-1] > RATE_LIMIT_WINDOW_S]:
        del _requetes[autre]  # purge des IP inactives : le dict ne grossit pas indéfiniment
    recentes = [t for t in _requetes.get(ip, []) if now - t < RATE_LIMIT_WINDOW_S] + [now]
    _requetes[ip] = recentes
    return len(recentes) > RATE_LIMIT_MAX


@router.post("")
def chat(data: ChatIn, request: Request, user=Depends(get_optional_user)) -> dict:
    if not data.message.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Message vide.")
    if len(data.message) > MAX_MESSAGE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Message trop long.")

    if data.honeypot or (data.formTs and time.time() * 1000 - data.formTs < 2000):
        # bot probable : réponse neutre, aucune recherche
        return agent._reponse("Merci pour votre message.", {}, [], [])

    ip = request.client.host if request.client else "inconnu"
    if _rate_limited(ip):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Trop de messages, réessayez dans quelques minutes.")

    # Sans identifiant : nouvelle session (jamais une session partagée entre visiteurs)
    session_id = re.sub(r"[^a-zA-Z0-9\-_]", "", data.sessionId or "")[:64] or crypto.new_token()
    exclure = disliked_ids(user["id"]) if user else set()
    # Déjà connecté : pas d'invitation à créer un compte, le front charge directement les résultats
    reponse = agent.repondre(session_id, data.message, exclure, connecte=user is not None)
    return {**reponse, "sessionId": session_id}


@router.get("/resultats/{search_id}")
def resultats(search_id: str, a_swiper: bool = False, user=Depends(get_current_user)) -> dict:
    if not user["email_verified"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Adresse email non vérifiée.")
    exclure = disliked_ids(user["id"])
    if a_swiper:
        with connect() as conn:
            exclure |= {r["annonce_id"] for r in conn.execute("SELECT annonce_id FROM likes WHERE user_id = ?", (user["id"],))}
    data = agent.charger_recherche(search_id, user["id"], exclure)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recherche introuvable.")
    return data
