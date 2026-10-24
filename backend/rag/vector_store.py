# =============================================================================
# backend/rag/vector_store.py — Indexation et recherche sémantique (ChromaDB)
# =============================================================================
# Les annonces sont vectorisées avec sentence-transformers (all-MiniLM-L6-v2)
# et stockées dans ChromaDB. Chemin de l'index : variable CHROMA_PATH
# (défaut data/chroma, ":memory:" pour un index éphémère, utilisé en test).
# =============================================================================

import logging
import os
from contextlib import suppress
from functools import lru_cache
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

from backend.loaders.annonces_loader import document_rag

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
COLLECTION = "annonces"


@lru_cache(maxsize=1)
def get_client():
    """Client ChromaDB, créé à la première utilisation."""
    path = os.environ.get("CHROMA_PATH", str(ROOT / "data" / "chroma"))
    return chromadb.EphemeralClient() if path == ":memory:" else chromadb.PersistentClient(path=path)


@lru_cache(maxsize=1)
def _get_ef():
    return embedding_functions.SentenceTransformerEmbeddingFunction(model_name=EMBEDDING_MODEL)


def get_collection():
    return get_client().get_or_create_collection(name=COLLECTION, embedding_function=_get_ef())


def reset_collection() -> None:
    """Supprime la collection (absente : rien à faire) avant une ré-indexation complète."""
    with suppress(Exception):
        get_client().delete_collection(COLLECTION)


def _sanitize(d: dict) -> dict:
    """Chroma n'accepte que str/int/float/bool en métadonnées."""
    result = {}
    for k, v in d.items():
        if v is None:
            result[k] = ""
        elif isinstance(v, (str, int, float, bool)):
            result[k] = v
        elif isinstance(v, list):
            result[k] = ", ".join(str(x) for x in v)
        else:
            result[k] = str(v)
    return result


def index_annonces(annonces: list[dict]) -> None:
    """Indexe (upsert) une liste d'annonces dans ChromaDB."""
    # Clé = id : un doublon dans le lot (CSV complété deux fois) ferait échouer
    # tout l'upsert (DuplicateIDError) ; la dernière version l'emporte.
    lot = {}
    for i, a in enumerate(annonces):
        doc_id = str(a.get("id") or a.get("id_source") or a.get("url_source") or i)
        meta = _sanitize({k: v for k, v in a.items() if k not in ("description", "photos")})
        lot[doc_id] = (document_rag(a), meta or {"id": doc_id})  # Chroma refuse les metadata vides
    if not lot:
        return
    collection = get_collection()
    ids = list(lot)
    taille = get_client().get_max_batch_size()
    for debut in range(0, len(ids), taille):
        morceau = ids[debut:debut + taille]
        # upsert : ré-indexation idempotente (add lève DuplicateIDError)
        collection.upsert(ids=morceau, documents=[lot[i][0] for i in morceau], metadatas=[lot[i][1] for i in morceau])


def search_similar(query: str, n: int = 5) -> list[dict]:
    """Recherche sémantique — retourne les n biens les plus proches (distance croissante)."""
    try:
        results = get_collection().query(query_texts=[query], n_results=n)
    except Exception:
        # Index indisponible : la recherche dégrade en « aucun résultat », mais on garde la trace
        logger.exception("Recherche ChromaDB impossible")
        return []
    biens = []
    if results and results["metadatas"]:
        for i, meta in enumerate(results["metadatas"][0]):
            bien = meta.copy()
            bien["description"] = results["documents"][0][i] if results.get("documents") else ""
            bien["distance"] = results["distances"][0][i] if results.get("distances") else 0
            biens.append(bien)
    return biens
