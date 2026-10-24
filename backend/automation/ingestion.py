# =============================================================================
# backend/automation/ingestion.py — Pipeline d'ingestion quotidienne
# =============================================================================
# Planifiée chaque jour à 7h00 par l'API (APScheduler), ou à la main :
#   POST /api/admin/sync   ou   python -m backend.automation.ingestion [--dry-run]
#
#   1. Appelle toutes les sources actives
#   2. Déduplique par url_source (vs index + entre sources)
#   3. Ajoute les nouvelles annonces à data/annonces_bienici.csv
#   4. Les indexe dans ChromaDB
#   5. Déclenche les alertes pour les profils correspondants
# =============================================================================

import logging
import threading
from datetime import datetime
from pathlib import Path

from backend.automation.alerts import verifier_nouveaux_biens
from backend.automation.sources import SOURCES_ACTIVES
from backend.loaders.annonces_loader import ecrire_csv, nettoyer_description
from backend.rag.assistant import indexer_si_vide
from backend.rag.vector_store import get_collection, index_annonces

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
LAST_RUN_FILE = ROOT / "data" / ".last_sync"

# Le cron de 7h et POST /api/admin/sync peuvent se chevaucher : deux syncs
# simultanées verraient les mêmes nouveautés et les ajouteraient deux fois au CSV.
_SYNC_LOCK = threading.Lock()


def annonces_deja_indexees() -> set[str]:
    """Retourne les url_source déjà présentes dans ChromaDB."""
    results = get_collection().get(include=["metadatas"])
    return {m.get("url_source", "") for m in results["metadatas"] if m.get("url_source")}


def dedupe(annonces: list[dict], deja_vues: set[str] = frozenset()) -> list[dict]:
    """Une annonce par url_source, hors celles de `deja_vues`."""
    vues, uniques = set(deja_vues), []
    for a in annonces:
        url = a.get("url_source")
        if url and url not in vues:
            vues.add(url)
            uniques.append(a)
    return uniques


def sync(dry_run: bool = False) -> dict:
    """
    Lance la synchronisation complète.

    Args:
        dry_run: si True, scrape et détecte les nouveautés sans rien écrire

    Returns:
        {"nouvelles": int, "sources": dict, "alertes_envoyees": int, "erreurs": list}
    """
    rapport = {"nouvelles": 0, "sources": {}, "alertes_envoyees": 0, "erreurs": []}
    if not _SYNC_LOCK.acquire(blocking=False):
        logger.warning("Sync déjà en cours : appel ignoré")
        rapport["erreurs"].append("Synchronisation déjà en cours.")
        return rapport
    try:
        _sync(rapport, dry_run)
    finally:
        _SYNC_LOCK.release()
    return rapport


def _sync(rapport: dict, dry_run: bool) -> None:
    debut = datetime.now()
    logger.info("Sync démarrée — %s source(s) active(s)", len(SOURCES_ACTIVES))

    if not SOURCES_ACTIVES:
        logger.warning("Aucune source active. Activez-en dans backend/automation/sources/__init__.py")
        return

    # Index absent (nouveau poste, data/chroma supprimé) : sans cela toutes les
    # annonces du CSV passeraient pour nouvelles et y seraient ajoutées en double.
    indexer_si_vide()
    indexees = annonces_deja_indexees()

    toutes_annonces = []
    for source in SOURCES_ACTIVES:
        try:
            annonces = source.fetch_new()
            rapport["sources"][source.name] = len(annonces)
            toutes_annonces.extend(annonces)
            logger.info("  %s → %s annonces récupérées", source.name, len(annonces))
        except Exception as e:
            msg = f"{source.name} : {e}"
            logger.error(msg)
            rapport["erreurs"].append(msg)

    nouvelles = dedupe(toutes_annonces, indexees)
    for a in nouvelles:
        a["description"] = nettoyer_description(a.get("description"))
    rapport["nouvelles"] = len(nouvelles)
    logger.info("%s nouvelles annonces à indexer", len(nouvelles))

    if dry_run or not rapport["sources"]:
        return

    if nouvelles:
        try:
            # Index d'abord : en cas d'échec rien n'est écrit et la sync suivante réessaie
            index_annonces(nouvelles)
            ecrire_csv(nouvelles, append=True)
        except Exception as e:
            rapport["erreurs"].append(f"Indexation : {e}")
            logger.error("Erreur indexation : %s", e)
            return

        alertes = verifier_nouveaux_biens(nouvelles)
        rapport["alertes_envoyees"] = alertes["alertes_envoyees"]
        rapport["erreurs"].extend(alertes["erreurs"])

    LAST_RUN_FILE.write_text(debut.isoformat(), encoding="utf-8")
    logger.info("Sync terminée en %ss — %s", (datetime.now() - debut).seconds, rapport)


if __name__ == "__main__":
    from argparse import ArgumentParser
    logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")
    parser = ArgumentParser(description="Ingestion des annonces → CSV + ChromaDB + alertes")
    parser.add_argument("--dry-run", action="store_true")
    print(sync(dry_run=parser.parse_args().dry_run))
