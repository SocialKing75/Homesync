"""
Source générique — extraction assistée par le LLM local (Ollama).

Pour toute source non structurée : page d'agence, post Facebook public,
texte copié-collé... Le LLM extrait les champs de l'annonce en JSON.

Usage :
    source = SourceGenerique()
    annonces = source.fetch_from_urls(["https://agence-xyz-toulon.fr/vente/..."])
"""
import logging

import requests

from backend.rag import llm_client
from .base import SourceBase

logger = logging.getLogger(__name__)

PROMPT_EXTRACTION = """Extrais les informations immobilières depuis ce contenu.
Retourne UNIQUEMENT du JSON valide, sans texte autour :
{
  "id_source": "identifiant unique si présent, sinon null",
  "url_source": "url de la page si connue, sinon null",
  "type": "T1/T2/T3/T4/maison/immeuble ou null",
  "surface": nombre ou null,
  "prix": nombre ou null,
  "quartier": "nom du quartier à Toulon ou null",
  "ville": "Toulon",
  "description": "description complète du bien",
  "photos": [],
  "nb_pieces": nombre ou null,
  "dpe": "A/B/C/D/E/F/G ou null"
}
Si ce n'est pas une annonce immobilière, retourne null."""


class SourceGenerique(SourceBase):
    name = "generique"

    def fetch_new(self) -> list[dict]:
        # Source appelée manuellement avec fetch_from_urls() / fetch_from_text()
        return []

    def fetch_from_text(self, texte: str, url_source: str = "") -> dict | None:
        """Extrait une annonce depuis un texte brut."""
        try:
            data = llm_client.generate_json(f"{PROMPT_EXTRACTION}\n\nContenu :\n{texte}")
        except Exception as e:
            logger.warning("Extraction échouée : %s", e)
            return None
        if not isinstance(data, dict):  # null (pas une annonce) ou liste renvoyée par le LLM
            return None
        data["url_source"] = data.get("url_source") or url_source
        return self.normalize(data)

    def fetch_from_urls(self, urls: list[str]) -> list[dict]:
        """Extrait des annonces depuis une liste d'URLs quelconques."""
        annonces = []
        for url in urls:
            try:
                html = requests.get(url, timeout=10).text[:8000]
            except Exception as e:
                logger.warning("%s ignorée : %s", url, e)
                continue
            annonce = self.fetch_from_text(html, url_source=url)
            if annonce:
                annonces.append(annonce)
        return annonces
