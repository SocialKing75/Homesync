"""
Source : Bien'ici — annonces immobilières à vendre dans plusieurs villes de France.

Bien'ici expose une API JSON non officielle utilisée par leur site web.
Les villes viennent de backend/automation/villes.py (SCRAPING_VILLES pour surcharger).
"""
import json
import logging
import time
from datetime import date

import requests

from backend.automation.villes import villes_actives, zone_id
from .base import SourceBase

logger = logging.getLogger(__name__)


class BienIciSource(SourceBase):
    name = "bienici"

    API_URL = "https://www.bienici.com/realEstateAds.json"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }
    PAGE_SIZE = 100
    MAX_PHOTOS = 10
    PAR_VILLE = 20
    QUOTAS = {"Toulon": 300}  # ville historique du projet : couverture complète

    def __init__(self, villes: list[str] | None = None, par_ville: int = PAR_VILLE):
        self.villes = villes
        self.par_ville = par_ville

    def fetch_new(self) -> list[dict]:
        """Récupère `par_ville` annonces (appartements/maisons) par ville, ou le quota de la ville."""
        annonces: list[dict] = []
        for ville in self.villes or villes_actives():
            try:
                annonces.extend(self.fetch_ville(ville, self.QUOTAS.get(ville, self.par_ville)))
            except Exception as e:  # une ville en échec ne bloque pas les autres
                logger.error("bienici %s : %s", ville, e)
        return annonces

    def fetch_ville(self, ville: str, target_size: int) -> list[dict]:
        zone = zone_id(ville)
        if not zone:
            return []
        annonces: list[dict] = []
        for offset in range(0, target_size, self.PAGE_SIZE):
            filters = {
                "size": min(self.PAGE_SIZE, target_size - offset),
                "from": offset,
                "filterType": "buy",
                "propertyType": ["flat", "house"],
                "page": offset // self.PAGE_SIZE + 1,
                "sortBy": "relevance",
                "sortOrder": "desc",
                "onTheMarket": [True],
                "zoneIdsByTypes": {"zoneIds": [zone]},
            }
            response = requests.get(
                self.API_URL,
                params={"filters": json.dumps(filters)},
                headers=self.HEADERS,
                timeout=30,
            )
            response.raise_for_status()
            ads = response.json().get("realEstateAds", [])
            if not ads:
                break
            annonces.extend(self.normalize(self._parse(a, ville)) for a in ads)
            time.sleep(1)  # politesse anti-ban : 1 req/s

        propres = [
            a for a in annonces
            if (a.get("prix") or 0) > 10_000 and 9 <= (a.get("surface") or 0) < 1_000
        ]
        logger.info("bienici %s : %s annonces, %s après filtre qualité", ville, len(annonces), len(propres))
        return propres

    @staticmethod
    def _valeur(v):
        """Programmes neufs : BienIci renvoie une fourchette [min, max] → on garde le min."""
        if isinstance(v, list):
            v = [x for x in v if x is not None]
            return min(v) if v else None
        return v

    def _parse(self, raw: dict, ville: str = "Toulon") -> dict:
        """Convertit un objet annonce BienIci vers le format standard."""
        pieces = self._valeur(raw.get("roomsQuantity"))
        base_type = {"flat": "Appartement", "house": "Maison"}.get(
            raw.get("propertyType"), raw.get("propertyType") or "")
        type_bien = f"{base_type} T{pieces}" if pieces else base_type
        district = raw.get("district") or {}
        quartier = district.get("libelle") or district.get("name") or raw.get("city") or ""
        position = (raw.get("blurInfo") or {}).get("position") or {}
        photos = [p.get("url") or p.get("url_photo") for p in raw.get("photos", [])]
        photos = [p for p in photos if p][: self.MAX_PHOTOS]
        return {
            "id_source":     str(raw.get("id", "")),
            "url_source":    f"https://www.bienici.com/annonce/{raw.get('id', '')}",
            "titre":         raw.get("title") or type_bien,
            "type":          type_bien,
            "surface":       self._valeur(raw.get("surfaceArea")),
            "prix":          self._valeur(raw.get("price")),
            "quartier":      quartier.replace(f"{ville} - ", ""),
            "ville":         ville,
            "code_postal":   raw.get("postalCode"),
            "description":   raw.get("description", ""),
            "photos":        photos,
            "photos_count":  len(raw.get("photos", [])),
            "nb_pieces":     pieces,
            "dpe":           raw.get("energyClassification"),
            "lat":           position.get("lat"),
            "lon":           position.get("lon"),
            "jardin":        bool(raw.get("hasGarden")),
            "piscine":       bool(raw.get("hasPool")),
            "terrasse":      bool(raw.get("terracesQuantity")),
            "date_scraping": date.today().isoformat(),
        }
