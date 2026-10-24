# =============================================================================
# annonces_loader.py — Annonces scrapées (BienIci, toute la France) pour le RAG
# =============================================================================
# Lit / complète data/annonces_bienici.csv, la source d'indexation ChromaDB.
# Les URLs des photos sont stockées dans une seule colonne, séparées par « | ».
# =============================================================================

from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
ANNONCES_CSV = ROOT / "data" / "annonces_bienici.csv"

CSV_FIELDNAMES = [
    "id_source", "url_source", "titre", "type", "surface", "prix", "quartier",
    "ville", "code_postal", "description", "nb_pieces", "dpe", "photos",
    "photos_count", "lat", "lon", "jardin", "piscine", "terrasse", "date_scraping",
]

SEPARATEUR_PHOTOS = "|"


def _to_float(value: Any) -> float | None:
    if value in ("", None):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> int | None:
    number = _to_float(value)
    return int(number) if number is not None else None


def _to_bool(value: Any) -> bool:
    return str(value).strip().lower() in ("1", "true", "oui", "yes")


def nettoyer_description(texte: str | None) -> str:
    """Retire les balises HTML (<br>…) des descriptions BienIci."""
    texte = re.sub(r"<[^>]+>", " ", texte or "")
    return re.sub(r"\s+", " ", texte).strip()


def charger_annonces_csv(path: Path = ANNONCES_CSV) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as csv_file:
        annonces = list(csv.DictReader(csv_file))
    for a in annonces:
        a["prix"] = _to_float(a.get("prix"))
        a["surface"] = _to_float(a.get("surface"))
        a["nb_pieces"] = _to_int(a.get("nb_pieces"))
        a["photos_count"] = _to_int(a.get("photos_count"))
        a["lat"] = _to_float(a.get("lat"))
        a["lon"] = _to_float(a.get("lon"))
        a["photos"] = [p for p in (a.get("photos") or "").split(SEPARATEUR_PHOTOS) if p]
        for champ in ("jardin", "piscine", "terrasse"):
            a[champ] = _to_bool(a.get(champ))
        a["description"] = nettoyer_description(a.get("description"))
        a["titre"] = a.get("titre") or a.get("type") or "Bien"
        a["ville"] = a.get("ville") or "Toulon"
    return annonces


def to_csv_row(annonce: dict) -> dict:
    row = {champ: annonce.get(champ) for champ in CSV_FIELDNAMES}
    row["description"] = nettoyer_description(annonce.get("description"))[:2000]
    row["photos"] = SEPARATEUR_PHOTOS.join(annonce.get("photos") or [])
    row["photos_count"] = annonce.get("photos_count", len(annonce.get("photos") or []))
    return row


def ecrire_csv(annonces: list[dict], path: Path = ANNONCES_CSV, append: bool = False) -> None:
    """Écrit les annonces au format CSV standard (ajout en fin de fichier si append)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    nouveau = not append or not path.exists()
    with path.open("a" if append else "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDNAMES, extrasaction="ignore")
        if nouveau:
            writer.writeheader()
        writer.writerows(to_csv_row(a) for a in annonces)


def document_rag(annonce: dict) -> str:
    """Texte vectorisé pour la recherche sémantique."""
    morceaux = [annonce.get("titre"), annonce.get("type"), annonce.get("quartier"), annonce.get("ville"),
                annonce.get("description")]
    return " — ".join(str(m) for m in morceaux if m)
