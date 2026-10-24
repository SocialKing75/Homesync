"""
Interface commune pour toutes les sources d'annonces.

Exemple minimal :
    class MaSource(SourceBase):
        name = "ma_source"
        def fetch_new(self) -> list[dict]:
            ...
"""
from abc import ABC, abstractmethod


class SourceBase(ABC):
    # Nom de la source — apparaît dans les logs et les métadonnées
    name: str = "source_inconnue"

    @abstractmethod
    def fetch_new(self) -> list[dict]:
        """
        Récupère les annonces nouvelles ou mises à jour.

        Returns:
            Liste de dicts. Chaque annonce contient au minimum :
            {
                "id_source":   str,   # identifiant unique côté source
                "url_source":  str,   # URL de l'annonce originale
                "type":        str,   # "Appartement T3", "Maison T5"...
                "surface":     float,
                "prix":        float,
                "quartier":    str,
                "ville":       str,
                "description": str,
                "photos":      list[str],
                "nb_pieces":   int | None,
                "dpe":         str | None,
            }
            Les champs manquants sont remplis avec None.
        """
        ...

    def normalize(self, raw: dict) -> dict:
        """Normalise un dict brut vers le format standard."""
        defaults = {
            "id_source": None, "url_source": None, "type": None,
            "surface": None, "prix": None, "quartier": None,
            "ville": "Toulon", "description": "", "photos": [],
            "nb_pieces": None, "dpe": None,
        }
        return {**defaults, **raw, "source": self.name}
