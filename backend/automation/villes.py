# =============================================================================
# backend/automation/villes.py — Villes couvertes par le scraping
# =============================================================================
# Liste par défaut : les plus grandes villes de France. Surcharge possible via
# la variable SCRAPING_VILLES="Lyon,Nantes,Toulon".
# Les identifiants de zone BienIci sont résolus par leur autocomplétion puis
# mis en cache dans data/bienici_zones.json.
# =============================================================================

import json
import logging
import os
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
ZONES_CACHE = ROOT / "data" / "bienici_zones.json"
SUGGEST_URL = "https://res.bienici.com/suggest.json"

VILLES_DEFAUT = [
    "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier",
    "Strasbourg", "Bordeaux", "Lille", "Rennes", "Toulon", "Reims", "Le Havre",
    "Grenoble", "Dijon", "Angers", "Nîmes", "Aix-en-Provence", "Brest",
]


def villes_actives() -> list[str]:
    env = os.getenv("SCRAPING_VILLES")
    return [v.strip() for v in env.split(",") if v.strip()] if env else list(VILLES_DEFAUT)


def zone_id(ville: str) -> str | None:
    """Identifiant de zone BienIci de la commune (cache, sinon autocomplétion)."""
    cache = json.loads(ZONES_CACHE.read_text(encoding="utf-8")) if ZONES_CACHE.exists() else {}
    if ville in cache:
        return cache[ville]
    response = requests.get(SUGGEST_URL, params={"q": ville}, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
    response.raise_for_status()
    commune = next((s for s in response.json() if s.get("type") == "city" and s.get("zoneIds")), None)
    if commune is None:
        logger.warning("Ville introuvable sur BienIci : %s", ville)
        return None
    cache[ville] = commune["zoneIds"][0]
    ZONES_CACHE.parent.mkdir(parents=True, exist_ok=True)
    ZONES_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    return cache[ville]
