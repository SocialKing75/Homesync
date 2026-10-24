# =============================================================================
# backend/automation/export_csv.py — Scraping complet → CSV → index ChromaDB
# =============================================================================
# Remplace data/annonces_bienici.csv par un scraping frais de toutes les villes
# actives, puis reconstruit l'index RAG.
#
# Usage : python -m backend.automation.export_csv [--par-ville 20] [--villes "Lyon,Nantes"]
# (Toulon garde son quota propre : BienIciSource.QUOTAS)
# =============================================================================

import logging
from argparse import ArgumentParser

from backend.automation.ingestion import dedupe
from backend.automation.sources.bienici import BienIciSource
from backend.loaders.annonces_loader import ANNONCES_CSV, charger_annonces_csv, ecrire_csv
from backend.rag.vector_store import get_collection, index_annonces, reset_collection


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")
    parser = ArgumentParser(description="Scraping BienIci multi-villes → CSV + ChromaDB")
    parser.add_argument("--par-ville", type=int, default=BienIciSource.PAR_VILLE)
    parser.add_argument("--villes", type=str, default="", help="Liste séparée par des virgules (défaut : villes actives)")
    args = parser.parse_args()

    villes = [v.strip() for v in args.villes.split(",") if v.strip()] or None
    annonces = dedupe(BienIciSource(villes=villes, par_ville=args.par_ville).fetch_new())
    if not annonces:
        raise SystemExit("Aucune annonce récupérée : CSV inchangé.")
    ecrire_csv(annonces)
    logging.info("%s annonces écrites dans %s", len(annonces), ANNONCES_CSV)

    reset_collection()
    index_annonces(charger_annonces_csv())
    logging.info("%s annonces indexées dans ChromaDB", get_collection().count())


if __name__ == "__main__":
    main()
