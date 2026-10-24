"""
Source : LeBonCoin — annonces particuliers et agences à Toulon.

L'API interne est protégée par Datadome : source désactivée par défaut.
"""
from .base import SourceBase


class LeBonCoinBlocked(RuntimeError):
    """LeBonCoin bloque le scraping automatisé (protection Datadome)."""


class LeBonCoinSource(SourceBase):
    name = "leboncoin"

    def fetch_new(self) -> list[dict]:
        # API interne (api.leboncoin.fr/finder/classified/search) bloquée par Datadome
        raise LeBonCoinBlocked("API LeBonCoin protégée par Datadome — non implémenté")
