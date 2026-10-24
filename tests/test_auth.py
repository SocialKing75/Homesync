"""Tests des comptes (/api/auth) et des favoris (/api/likes) sur une base SQLite temporaire."""

import re
import smtplib
import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend.auth import mailer, routes as auth_routes
from backend.api.main import app

PASSWORD = "MotDePasse123"
EMAIL = "Test.User@Example.com"


@pytest.fixture
def boite(monkeypatch, tmp_path):
    """Base temporaire + capture des emails envoyés."""
    monkeypatch.setenv("APP_DB_PATH", str(tmp_path / "app.db"))
    auth_routes._envois.clear()
    emails = []
    monkeypatch.setattr(mailer, "envoyer_email", lambda to, sujet, html: emails.append({"to": to, "sujet": sujet, "html": html}))
    return emails


@pytest.fixture
def client(boite):
    return TestClient(app)  # sans "with" : le scheduler d'ingestion ne démarre pas


def _token(email: dict) -> str:
    return re.search(r"token=([\w-]+)", email["html"]).group(1)


def _compte_verifie(client, boite) -> dict:
    client.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD, "nom": "Jo"})
    client.post("/api/auth/verify-email", json={"token": _token(boite[-1])})
    r = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# --- Inscription & vérification ---

def test_inscription_envoie_un_email_de_verification(client, boite):
    r = client.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 202
    assert boite[0]["to"] == "test.user@example.com"
    assert "verifier-email?token=" in boite[0]["html"]


def test_mot_de_passe_faible_refuse(client):
    r = client.post("/api/auth/register", json={"email": EMAIL, "password": "court"})
    assert r.status_code == 422


def test_connexion_refusee_tant_que_email_non_verifie(client, boite):
    client.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
    r = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 403


def test_inscription_ne_revele_pas_un_compte_existant(client, boite):
    _compte_verifie(client, boite)
    r = client.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 202
    assert len(boite) == 1  # aucun nouvel email pour un compte déjà actif


def test_lien_de_verification_a_usage_unique(client, boite):
    client.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
    token = _token(boite[0])
    assert client.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    assert client.post("/api/auth/verify-email", json={"token": token}).status_code == 400


def test_reinscription_non_verifiee_remplace_le_mot_de_passe(client, boite):
    """Un tiers qui inscrit l'adresse en premier ne garde pas l'accès au compte."""
    client.post("/api/auth/register", json={"email": EMAIL, "password": "MotDuPirate999"})
    client.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
    client.post("/api/auth/verify-email", json={"token": _token(boite[-1])})
    assert client.post("/api/auth/login", json={"email": EMAIL, "password": "MotDuPirate999"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 200


def test_panne_smtp_ne_revele_pas_le_compte(client, boite, monkeypatch):
    _compte_verifie(client, boite)

    def panne(*args):
        raise smtplib.SMTPException("serveur indisponible")
    monkeypatch.setattr(mailer, "envoyer_email", panne)
    assert client.post("/api/auth/forgot-password", json={"email": EMAIL}).status_code == 202


# --- Connexion & sécurité ---

def test_connexion_et_profil(client, boite):
    headers = _compte_verifie(client, boite)
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == "test.user@example.com"
    assert r.json()["nom"] == "Jo"


def test_mauvais_mot_de_passe(client, boite):
    _compte_verifie(client, boite)
    r = client.post("/api/auth/login", json={"email": EMAIL, "password": "Mauvais12345"})
    assert r.status_code == 401
    assert client.post("/api/auth/login", json={"email": "inconnu@x.fr", "password": PASSWORD}).status_code == 401


def test_verrouillage_apres_5_echecs(client, boite):
    _compte_verifie(client, boite)
    for _ in range(5):
        client.post("/api/auth/login", json={"email": EMAIL, "password": "Mauvais12345"})
    r = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 423


def test_route_protegee_sans_jeton(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer faux"}).status_code == 401


def test_deconnexion_invalide_le_jeton(client, boite):
    headers = _compte_verifie(client, boite)
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_donnees_chiffrees_en_base(client, boite, tmp_path):
    _compte_verifie(client, boite)
    conn = sqlite3.connect(tmp_path / "app.db")
    dump = "\n".join(conn.iterdump())
    assert "example.com" not in dump.lower()
    assert PASSWORD not in dump
    assert "Jo'" not in dump


# --- Mot de passe ---

def test_mot_de_passe_oublie(client, boite):
    headers = _compte_verifie(client, boite)
    r = client.post("/api/auth/forgot-password", json={"email": EMAIL})
    assert r.status_code == 202
    token = _token(boite[-1])
    nouveau = "NouveauMdp456"
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": nouveau}).status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401  # sessions révoquées
    assert client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 401
    assert client.post("/api/auth/login", json={"email": EMAIL, "password": nouveau}).status_code == 200


def test_pas_d_inondation_de_boite_mail(client, boite):
    _compte_verifie(client, boite)
    avant = len(boite)
    for _ in range(auth_routes.MAX_EMAILS + 3):
        assert client.post("/api/auth/forgot-password", json={"email": EMAIL}).status_code == 202
    assert len(boite) - avant == auth_routes.MAX_EMAILS


def test_mot_de_passe_trop_long(client, boite):
    long = "Aa1" * 50
    assert client.post("/api/auth/register", json={"email": "x@y.fr", "password": long}).status_code == 422
    assert client.post("/api/auth/login", json={"email": "x@y.fr", "password": long}).status_code == 401


def test_mot_de_passe_oublie_email_inconnu(client, boite):
    r = client.post("/api/auth/forgot-password", json={"email": "inconnu@x.fr"})
    assert r.status_code == 202
    assert boite == []


def test_changement_de_mot_de_passe(client, boite):
    headers = _compte_verifie(client, boite)
    r = client.post("/api/auth/change-password", headers=headers,
                    json={"current_password": PASSWORD, "new_password": "NouveauMdp456"})
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 200  # session courante conservée


# --- Suppression du compte ---

def test_suppression_du_compte(client, boite):
    headers = _compte_verifie(client, boite)
    client.put("/api/likes/1/gold", headers=headers)
    assert client.request("DELETE", "/api/auth/me", headers=headers, json={"password": "Mauvais12345"}).status_code == 401
    r = client.request("DELETE", "/api/auth/me", headers=headers, json={"password": PASSWORD})
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 401
    assert "supprimé" in boite[-1]["sujet"]


# --- Likes classiques & gold ---

def test_likes_classique_et_gold(client, boite):
    headers = _compte_verifie(client, boite)
    assert client.put("/api/likes/1", headers=headers).json()["type"] == "classique"
    assert client.put("/api/likes/2/gold", headers=headers).json()["type"] == "gold"

    assert client.get("/api/likes/ids", headers=headers).json() == {"classique": ["1"], "gold": ["2"]}
    golds = client.get("/api/likes?type=gold", headers=headers).json()
    assert [l["annonce_id"] for l in golds] == ["2"]
    assert golds[0]["annonce"]["quartier"]


def test_like_change_de_type(client, boite):
    headers = _compte_verifie(client, boite)
    client.put("/api/likes/1/classique", headers=headers)
    client.put("/api/likes/1/gold", headers=headers)
    assert client.get("/api/likes/ids", headers=headers).json() == {"classique": [], "gold": ["1"]}


def test_like_annonce_rag(client, boite):
    headers = _compte_verifie(client, boite)
    r = client.put("/api/likes/century-21-202_3064_5157", headers=headers, json={"type": "gold"})
    assert r.status_code == 200
    assert r.json()["annonce"]["source"] == "annonces"


def test_retirer_un_like(client, boite):
    headers = _compte_verifie(client, boite)
    client.put("/api/likes/1", headers=headers)
    assert client.delete("/api/likes/1", headers=headers).status_code == 200
    assert client.delete("/api/likes/1", headers=headers).status_code == 404
    assert client.get("/api/likes", headers=headers).json() == []


def test_like_annonce_inexistante_et_sans_compte(client, boite):
    headers = _compte_verifie(client, boite)
    assert client.put("/api/likes/inexistante", headers=headers).status_code == 404
    assert client.put("/api/likes/1").status_code == 401
