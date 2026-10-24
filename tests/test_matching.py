"""Tests du matching demande ↔ annonce (score /100) et de POST /api/matching."""

import os

os.environ["CHROMA_PATH"] = ":memory:"  # avant le premier accès à ChromaDB

import re

import pytest
from fastapi.testclient import TestClient

from backend.auth import mailer, routes as auth_routes
from backend.api.main import app
from backend.chat import routes as chat_routes
from backend.matching.scoring import POIDS, matcher, scorer

ANNONCE = {"id_source": "a1", "type": "Appartement T3", "nb_pieces": 3, "prix": 250000, "surface": 62,
           "ville": "Lyon", "quartier": "Gerland", "jardin": False, "terrasse": True, "piscine": False}
MEDIANES = {"Lyon": 5000}


def _points(resultat, critere):
    return next(d["points"] for d in resultat["detail"] if d["critere"] == critere)


# --- Score ---

def test_poids_totalisent_100():
    assert sum(POIDS.values()) == 100


def test_profil_vide_ne_penalise_pas():
    r = scorer(ANNONCE, {}, None, MEDIANES)
    assert [d["critere"] for d in r["detail"]] == list(POIDS)
    assert _points(r, "budget") == 25 and _points(r, "type") == 20 and _points(r, "surface") == 10


def test_annonce_parfaite():
    profil = {"villes": ["Lyon"], "type_bien": "Appartement", "pieces": 3, "budget_max": 260000,
              "surface_min": 60, "quartiers": ["Gerland"], "texte": "avec une terrasse"}
    r = scorer(ANNONCE, profil, 1.0, MEDIANES)  # 4 032 €/m² : 19 % sous la médiane
    assert r["score"] == 100


def test_budget_degressif():
    assert _points(scorer(ANNONCE, {"budget_max": 250000}, None, MEDIANES), "budget") == 25
    assert _points(scorer(ANNONCE, {"budget_max": 238000}, None, MEDIANES), "budget") == pytest.approx(12.4, abs=0.2)
    assert _points(scorer(ANNONCE, {"budget_max": 200000}, None, MEDIANES), "budget") == 0


def test_type_pieces_surface_quartier():
    r = scorer(ANNONCE, {"type_bien": "Maison", "pieces": 4, "surface_min": 66, "quartiers": ["Croix-Rousse"]}, None, MEDIANES)
    assert _points(r, "type") == 5          # mauvais type (0) + une pièce d'écart (5)
    assert _points(r, "surface") == 5       # 62 m² : moins de 10 % sous 66
    assert _points(r, "localisation") == 7  # autre quartier


def test_equipements_demandes():
    assert _points(scorer(ANNONCE, {"texte": "jardin et terrasse"}, None, MEDIANES), "envies") == 17  # 14 + 3/6
    assert _points(scorer({**ANNONCE, "jardin": True}, {"texte": "jardin et terrasse"}, None, MEDIANES), "envies") == 20


def test_prix_du_marche():
    assert _points(scorer(ANNONCE, {}, None, {"Lyon": 4032}), "marche") == 5                          # pile la médiane
    assert _points(scorer(ANNONCE, {}, None, {"Lyon": 4000}), "marche") == pytest.approx(4.7, abs=0.1)  # 0,8 % au-dessus
    assert _points(scorer(ANNONCE, {}, None, {"Lyon": 3000}), "marche") == 0                          # bien plus cher
    assert _points(scorer(ANNONCE, {}, None, {}), "marche") == 5                                       # pas de référence


def test_matcher_trie_par_score():
    annonces = [{**ANNONCE, "id_source": "cher", "prix": 400000}, {**ANNONCE, "id_source": "ok"}]
    classees = matcher({"budget_max": 260000}, annonces)
    assert [a["id_source"] for a in classees] == ["ok", "cher"]
    assert classees[0]["match"]["score"] > classees[1]["match"]["score"]


# --- API ---

@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_DB_PATH", str(tmp_path / "app.db"))
    auth_routes._envois.clear()
    chat_routes._requetes.clear()
    emails = []
    monkeypatch.setattr(mailer, "envoyer_email", lambda to, sujet, html: emails.append(html))
    c = TestClient(app)
    c.post("/api/auth/register", json={"email": "match@exemple.fr", "password": "MotDePasse123"})
    c.post("/api/auth/verify-email", json={"token": re.search(r"token=([\w-]+)", emails[-1]).group(1)})
    jeton = c.post("/api/auth/login", json={"email": "match@exemple.fr", "password": "MotDePasse123"}).json()["access_token"]
    c.h = {"Authorization": f"Bearer {jeton}"}
    return c


def test_api_matching(client):
    assert client.post("/api/matching", json={}).status_code == 401
    r = client.post("/api/matching", headers=client.h,
                    json={"villes": ["Toulon"], "type_bien": "Appartement", "budget_max": 250000, "texte": "vue mer terrasse", "limite": 10})
    assert r.status_code == 200
    res = r.json()
    assert len(res) == 10 and all(a["ville"] == "Toulon" for a in res)
    scores = [a["match"]["score"] for a in res]
    assert scores == sorted(scores, reverse=True) and 0 <= scores[-1] <= scores[0] <= 100
    assert client.post("/api/matching", headers=client.h, json={"villes": ["A", "B", "C", "D"]}).status_code == 422


def test_api_matching_exclut_les_dislikes(client):
    premiere = client.post("/api/matching", headers=client.h, json={"villes": ["Lyon"], "limite": 1}).json()[0]["id_source"]
    client.put(f"/api/dislikes/{premiere}", headers=client.h)
    ids = [a["id_source"] for a in client.post("/api/matching", headers=client.h, json={"villes": ["Lyon"], "limite": 50}).json()]
    assert premiere not in ids


def test_resultats_du_chat_classes_par_match(client):
    r = client.post("/api/chat", headers=client.h, json={"message": "Appartement lumineux à Toulon budget 300k", "sessionId": "m1"}).json()
    annonces = client.get(f"/api/chat/resultats/{r['resultats']['search_id']}", headers=client.h).json()["annonces"]
    scores = [a["match"]["score"] for a in annonces]
    assert scores == sorted(scores, reverse=True)
    assert {d["critere"] for d in annonces[0]["match"]["detail"]} == set(POIDS)
    # Régression : la ressemblance au texte est calculée pour TOUTES les candidates,
    # même hors du haut du classement sémantique global
    envies = [next(d for d in a["match"]["detail"] if d["critere"] == "envies")["explication"] for a in annonces]
    assert all("Ressemblance" in e for e in envies)
