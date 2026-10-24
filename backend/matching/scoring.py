# =============================================================================
# backend/matching/scoring.py — Score de compatibilité demande ↔ annonce (/100)
# =============================================================================
# Critères et poids :
#   budget        25  prix ≤ budget ; dégressif jusqu'à +10 %, 0 au-delà
#   type          20  type de bien (10) + nombre de pièces (10, ±1 pièce = 5)
#   envies        20  ressemblance sémantique du texte libre (14) + équipements
#                     demandés présents : jardin, terrasse/balcon, piscine (6)
#   localisation  15  quartier souhaité (sinon 7 si des quartiers sont demandés)
#   surface       10  ≥ surface minimale ; 5 si à moins de 10 % en dessous
#   marché        10  prix au m² vs médiane des annonces de la même ville
# Un critère non renseigné par l'utilisateur donne tous ses points : il ne
# pénalise aucune annonce. Les villes demandées sont un filtre strict.
# =============================================================================

from __future__ import annotations

import re
from functools import lru_cache
from statistics import median

from backend.chat.garde_fous import _norm
from backend.loaders.annonces_loader import ANNONCES_CSV, charger_annonces_csv
from backend.rag.vector_store import get_collection, search_similar

POIDS = {"budget": 25, "type": 20, "envies": 20, "localisation": 15, "surface": 10, "marche": 10}
EQUIPEMENTS = {"jardin": r"jardin|exterieur", "terrasse": r"terrasse|balcon", "piscine": r"piscine"}


def _eur(n: float) -> str:
    return f"{n:,.0f} €".replace(",", " ")


@lru_cache(maxsize=1)
def _medianes(_version: int) -> dict[str, float]:
    par_ville: dict[str, list[float]] = {}
    for a in charger_annonces_csv():
        if a.get("prix") and a.get("surface"):
            par_ville.setdefault(a["ville"], []).append(a["prix"] / a["surface"])
    return {ville: median(v) for ville, v in par_ville.items() if len(v) >= 5}


def medianes_prix_m2() -> dict[str, float]:
    """Prix au m² médian par ville (recalculé quand le CSV change)."""
    return _medianes(ANNONCES_CSV.stat().st_mtime_ns if ANNONCES_CSV.exists() else 0)


def proximites(texte: str, ids: set[str]) -> dict[str, float]:
    """Ressemblance sémantique texte ↔ annonces, ramenée entre 0 (la moins proche) et 1 (la plus proche)."""
    if not texte.strip() or not ids:
        return {}
    # Tout l'index : les candidates (filtrées par ville, budget…) ne sont pas forcément dans le haut du classement global
    distances = {b["id_source"]: b["distance"] for b in search_similar(texte, n=max(get_collection().count(), 1))
                 if b.get("id_source") in ids}
    if not distances:
        return {}
    lo, hi = min(distances.values()), max(distances.values())
    return {i: 1.0 if hi == lo else 1 - (d - lo) / (hi - lo) for i, d in distances.items()}


def _critere(nom: str, points: float, explication: str) -> dict:
    return {"critere": nom, "points": round(points, 1), "max": POIDS[nom], "explication": explication}


def scorer(a: dict, profil: dict, proximite: float | None = None, medianes: dict | None = None) -> dict:
    """Score d'une annonce pour un profil. `proximite` ∈ [0, 1] : ressemblance au texte libre."""
    detail = []
    prix, surface = a.get("prix") or 0, a.get("surface") or 0

    budget = profil.get("budget_max")
    if not budget:
        detail.append(_critere("budget", 25, "Pas de budget indiqué"))
    elif prix <= budget:
        detail.append(_critere("budget", 25, f"{_eur(prix)}, dans le budget ({_eur(budget)})"))
    elif prix <= budget * 1.1:
        depasse = (prix - budget) / budget
        detail.append(_critere("budget", 25 * (1 - depasse / 0.1), f"Dépasse le budget de {depasse:.0%}"))
    else:
        detail.append(_critere("budget", 0, f"Hors budget ({_eur(prix)})"))

    type_voulu, pieces = profil.get("type_bien"), profil.get("pieces")
    pts_type = 10 if not type_voulu or str(a.get("type", "")).startswith(type_voulu) else 0
    ecart = abs((a.get("nb_pieces") or 0) - pieces) if pieces else 0
    pts_pieces = 10 if ecart == 0 else 5 if ecart == 1 else 0
    souhait = " ".join(x for x in (type_voulu, f"T{pieces}" if pieces else None) if x)
    detail.append(_critere("type", pts_type + pts_pieces, f"{a.get('type') or 'Bien'}" + (f" — souhaité : {souhait}" if souhait else "")))

    texte = _norm(profil.get("texte") or "")
    voulus = [e for e, motif in EQUIPEMENTS.items() if re.search(motif, texte)]
    presents = [e for e in voulus if a.get(e)]
    pts_semantique = 14 if proximite is None else 14 * proximite
    pts_equip = 6 if not voulus else 6 * len(presents) / len(voulus)
    morceaux = []
    if proximite is not None:
        morceaux.append(f"Ressemblance avec votre description : {proximite:.0%} (comparée aux autres annonces)")
    if voulus:
        morceaux.append(" · ".join(f"{e} {'✓' if a.get(e) else '✗'}" for e in voulus))
    detail.append(_critere("envies", pts_semantique + pts_equip, " · ".join(morceaux) or "Pas d'envie particulière"))

    quartiers = profil.get("quartiers") or []
    if not quartiers:
        lieu = " · ".join(x for x in (a.get("ville"), a.get("quartier")) if x)
        detail.append(_critere("localisation", 15, lieu or "Localisation non précisée"))
    elif a.get("quartier") in quartiers:
        detail.append(_critere("localisation", 15, f"Quartier souhaité : {a.get('quartier')}"))
    else:
        detail.append(_critere("localisation", 7, f"Autre quartier : {a.get('quartier') or 'non précisé'}"))

    surface_min = profil.get("surface_min")
    if not surface_min:
        detail.append(_critere("surface", 10, f"{surface:.0f} m²"))
    elif surface >= surface_min:
        detail.append(_critere("surface", 10, f"{surface:.0f} m² ≥ {surface_min:.0f} m²"))
    elif surface >= surface_min * 0.9:
        detail.append(_critere("surface", 5, f"{surface:.0f} m², un peu moins que {surface_min:.0f} m²"))
    else:
        detail.append(_critere("surface", 0, f"{surface:.0f} m², trop petit"))

    med = (medianes if medianes is not None else medianes_prix_m2()).get(a.get("ville"))
    if not med or not prix or not surface:
        detail.append(_critere("marche", 5, "Pas assez de références de prix dans cette ville"))
    else:
        ratio = (prix / surface) / med
        pts = 10 if ratio <= 0.85 else 0 if ratio >= 1.15 else 10 * (1.15 - ratio) / 0.3
        detail.append(_critere("marche", pts, f"{_eur(prix / surface)}/m², {abs(ratio - 1):.0%} "
                                              f"{'sous' if ratio < 1 else 'au-dessus de'} la médiane de {a.get('ville')}"))

    return {"score": round(sum(d["points"] for d in detail)), "detail": detail}


def matcher(profil: dict, annonces: list[dict], gouts: str = "") -> list[dict]:
    """Annonces enrichies de `match` ({score, detail}), triées de la plus à la moins compatible.

    `gouts` : titres des annonces likées en gold, ajoutés au texte pour la ressemblance."""
    texte = " ".join(t for t in (profil.get("texte"), gouts) if t)
    proches = proximites(texte, {a["id_source"] for a in annonces})
    medianes = medianes_prix_m2()
    notees = [{**a, "match": scorer(a, profil, proches.get(a["id_source"]) if proches else None, medianes)}
              for a in annonces]
    return sorted(notees, key=lambda a: a["match"]["score"], reverse=True)
