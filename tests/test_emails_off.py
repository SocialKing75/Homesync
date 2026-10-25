"""EMAILS=off : parcours sans email (comptes actifs dès l'inscription, pas de mot de passe oublié)."""

import pytest
from fastapi.testclient import TestClient

from backend.auth import mailer, routes as auth_routes
from backend.automation import alerts
from backend.api.main import app

PASSWORD = "MotDePasse123"
EMAIL = "sans.email@example.com"


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_DB_PATH", str(tmp_path / "app.db"))
    monkeypatch.setenv("EMAILS", "off")
    auth_routes._envois.clear()
    return TestClient(app)


def test_compte_actif_des_l_inscription(client):
    r = client.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD, "nom": "Jo"})
    assert r.status_code == 202 and r.json()["compte_actif"] is True
    r = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200 and r.json()["user"]["email_verifie"] is True


def test_reinscription_ne_change_pas_un_compte_actif(client):
    client.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
    client.post("/api/auth/register", json={"email": EMAIL, "password": "AutreMotDePasse9"})
    assert client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 200
    assert client.post("/api/auth/login", json={"email": EMAIL, "password": "AutreMotDePasse9"}).status_code == 401


def test_parcours_email_indisponibles(client):
    assert client.post("/api/auth/forgot-password", json={"email": EMAIL}).status_code == 503
    assert client.post("/api/auth/resend-verification", json={"email": EMAIL}).status_code == 503


def test_aucun_email_envoye(client, monkeypatch):
    envoyes = []
    monkeypatch.setattr(mailer.smtplib, "SMTP", lambda *a, **k: envoyes.append(a))
    monkeypatch.setenv("SMTP_USER", "x@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    mailer.envoyer_email("a@example.com", "Sujet", "<p>x</p>")
    alerts.notifier_email("a@example.com", [{"titre": "T2", "prix": 1}])
    assert envoyes == []
