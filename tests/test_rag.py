"""Tests du module RAG (index ChromaDB éphémère) et du filtre d'alertes."""

import os

os.environ["CHROMA_PATH"] = ":memory:"  # avant le premier accès à ChromaDB

import pytest

from backend.automation.alerts import filtrer_pour_profil
from backend.loaders.annonces_loader import charger_annonces_csv, nettoyer_description
from backend.rag import vector_store
from backend.rag.assistant import comprendre_question


@pytest.fixture(autouse=True)
def reset_chromadb():
    vector_store.reset_collection()
    vector_store.get_collection()


def test_indexation_et_recherche():
    annonce = {"id": "1", "type": "T3", "surface": 68, "quartier": "Mourillon", "description": "Vue mer calme"}
    vector_store.index_annonces([annonce])

    results = vector_store.search_similar("T3 calme proche mer", n=5)
    assert len(results) > 0
    assert results[0]["quartier"] == "Mourillon"


def test_recherche_retourne_n_resultats():
    annonces = [
        {"id": "1", "type": "T3", "surface": 68, "quartier": "Mourillon", "description": "Vue mer calme"},
        {"id": "2", "type": "T2", "surface": 45, "quartier": "Port", "description": "Beau T2 rénové"},
        {"id": "3", "type": "T4", "surface": 90, "quartier": "Cap Brun", "description": "Villa avec piscine"},
    ]
    vector_store.index_annonces(annonces)

    assert len(vector_store.search_similar("appartement", n=2)) == 2


def test_reindexation_idempotente():
    annonce = {"id": "1", "type": "T3", "description": "Vue mer"}
    vector_store.index_annonces([annonce])
    vector_store.index_annonces([annonce])
    assert vector_store.get_collection().count() == 1


def test_comprendre_question():
    criteres = comprendre_question("Je veux investir dans un T3 à Toulon, budget 250k")
    assert criteres == {"type_bien": "T3", "ville": "Toulon", "budget_max": 250000.0, "objectif": "investissement"}


def test_csv_annonces_charge():
    annonces = charger_annonces_csv()
    assert len(annonces) >= 300
    assert all("<br>" not in a["description"] for a in annonces)


def test_nettoyer_description():
    assert nettoyer_description("Beau T2<br>vue mer") == "Beau T2 vue mer"


def test_bienici_fourchette_de_prix():
    from backend.automation.sources.bienici import BienIciSource
    annonce = BienIciSource()._parse({"id": "x", "price": [250000, 310000], "surfaceArea": [55.0, 70.0],
                                      "roomsQuantity": [3, 4], "propertyType": "flat"})
    assert (annonce["prix"], annonce["surface"], annonce["type"]) == (250000, 55.0, "Appartement T3")


def test_filtre_alerte():
    biens = [
        {"prix": 200000, "surface": 50, "quartier": "Mourillon"},
        {"prix": 400000, "surface": 80, "quartier": "Mourillon"},
        {"prix": 150000, "surface": 30, "quartier": "Le Port"},
    ]
    profil = {"budget_max": 300000, "surface_min": 40, "quartiers": ["Mourillon"]}
    assert filtrer_pour_profil(biens, profil) == [biens[0]]
