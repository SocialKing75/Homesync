"""Tests du dossier de candidature (/api/dossier) et des candidatures (/api/candidatures)."""

import io
import re
import zipfile
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.auth import mailer, routes as auth_routes
from backend.api.main import app
from backend.dossier import routes as dossier_routes
from backend.loaders.annonces_loader import charger_annonces_csv

PASSWORD = "MotDePasse123"
PDF = b"%PDF-1.4\n% faux bulletin de test\n%%EOF"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_DB_PATH", str(tmp_path / "app.db"))
    monkeypatch.setattr(dossier_routes, "DOSSIERS_DIR", tmp_path / "dossiers")
    auth_routes._envois.clear()
    emails = []
    monkeypatch.setattr(mailer, "envoyer_email", lambda to, sujet, html: emails.append(html))
    c = TestClient(app)
    c.emails = emails
    return c


def _compte(client, email="dossier@exemple.fr") -> dict:
    client.post("/api/auth/register", json={"email": email, "password": PASSWORD})
    token = re.search(r"token=([\w-]+)", client.emails[-1]).group(1)
    client.post("/api/auth/verify-email", json={"token": token})
    r = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _deposer(client, h, piece, contenu=PDF, nom="doc.pdf", **form):
    return client.post("/api/dossier/documents", headers=h, data={"piece": piece, **form},
                       files={"fichier": (nom, contenu, "application/pdf")})


def _dossier_particulier_complet(client, h):
    client.put("/api/dossier/profil", headers=h, json={"profil": "particulier"})
    for piece in ("identite", "avis_imposition", "rib"):
        assert _deposer(client, h, piece).status_code == 201
    for i in range(3):
        assert _deposer(client, h, "bulletins_salaire", nom=f"bulletin_{i}.pdf").status_code == 201


def _piece(etat, piece_id):
    return next(p for p in etat["pieces"] if p["id"] == piece_id)


# --- Checklist selon le profil ---

def test_dossier_reserve_aux_comptes_verifies(client):
    assert client.get("/api/dossier").status_code == 401


def test_checklist_particulier_et_societe(client):
    h = _compte(client)
    assert client.get("/api/dossier", headers=h).json()["profil"] is None
    etat = client.put("/api/dossier/profil", headers=h, json={"profil": "particulier"}).json()
    assert [p["id"] for p in etat["pieces"]] == ["identite", "bulletins_salaire", "avis_imposition", "rib", "justificatif_apport"]
    assert not _piece(etat, "justificatif_apport")["obligatoire"] and _piece(etat, "bulletins_salaire")["nombre"] == 3
    assert len(etat["manquantes"]) == 4 and not etat["complet"]

    etat = client.put("/api/dossier/profil", headers=h, json={"profil": "societe"}).json()
    assert [p["id"] for p in etat["pieces"]] == ["kbis", "comptes_annuels", "bilan", "identite_dirigeant"]
    assert client.put("/api/dossier/profil", headers=h, json={"profil": "autre"}).status_code == 422


def test_dossier_complet_sans_piece_facultative(client):
    h = _compte(client)
    _dossier_particulier_complet(client, h)
    etat = client.get("/api/dossier", headers=h).json()
    assert etat["complet"] and etat["manquantes"] == []
    assert not _piece(etat, "justificatif_apport")["complete"]


# --- Dépôt sécurisé ---

def test_fichier_chiffre_sur_disque_et_telechargeable(client, tmp_path):
    h = _compte(client)
    client.put("/api/dossier/profil", headers=h, json={"profil": "particulier"})
    doc = _piece(_deposer(client, h, "identite", nom="cni.pdf").json(), "identite")["documents"][0]
    assert doc["nom"] == "cni.pdf" and doc["mime"] == "application/pdf"

    fichiers = list((tmp_path / "dossiers").rglob("*"))
    brut = next(f for f in fichiers if f.is_file()).read_bytes()
    assert b"%PDF" not in brut and b"faux bulletin" not in brut  # chiffré

    r = client.get(f"/api/dossier/documents/{doc['id']}", headers=h)
    assert r.content == PDF and "attachment" in r.headers["content-disposition"]
    assert r.headers["cache-control"] == "no-store"


def test_un_autre_compte_ne_voit_pas_les_pieces(client):
    h1 = _compte(client, "un@exemple.fr")
    client.put("/api/dossier/profil", headers=h1, json={"profil": "particulier"})
    doc_id = _piece(_deposer(client, h1, "rib").json(), "rib")["documents"][0]["id"]
    h2 = _compte(client, "deux@exemple.fr")
    assert client.get(f"/api/dossier/documents/{doc_id}", headers=h2).status_code == 404
    assert client.delete(f"/api/dossier/documents/{doc_id}", headers=h2).status_code == 404


def test_formats_et_taille_controles(client):
    h = _compte(client)
    client.put("/api/dossier/profil", headers=h, json={"profil": "particulier"})
    assert _deposer(client, h, "identite", contenu=b"MZ\x90\x00 exe", nom="cni.pdf").status_code == 415
    assert _deposer(client, h, "identite", contenu=PNG, nom="cni.png").status_code == 201
    gros = b"%PDF-" + b"0" * (dossier_routes.MAX_TAILLE + 1)
    assert _deposer(client, h, "rib", contenu=gros).status_code == 413
    assert _deposer(client, h, "kbis").status_code == 400  # pièce d'un autre profil


def test_piece_unique_remplacee_et_bulletins_limites_a_3(client):
    h = _compte(client)
    client.put("/api/dossier/profil", headers=h, json={"profil": "particulier"})
    _deposer(client, h, "rib", nom="ancien.pdf")
    etat = _deposer(client, h, "rib", nom="nouveau.pdf").json()
    assert [d["nom"] for d in _piece(etat, "rib")["documents"]] == ["nouveau.pdf"]
    for i in range(3):
        _deposer(client, h, "bulletins_salaire", nom=f"b{i}.pdf")
    assert _deposer(client, h, "bulletins_salaire", nom="b4.pdf").status_code == 409


def test_kbis_de_moins_de_trois_mois(client):
    h = _compte(client)
    client.put("/api/dossier/profil", headers=h, json={"profil": "societe"})
    assert _deposer(client, h, "kbis").status_code == 422  # date obligatoire
    vieux = (date.today() - timedelta(days=120)).isoformat()
    assert _deposer(client, h, "kbis", date_document=vieux).status_code == 422
    recent = (date.today() - timedelta(days=20)).isoformat()
    assert _deposer(client, h, "kbis", date_document=recent).status_code == 201


def test_suppression_d_une_piece_et_du_dossier(client, tmp_path):
    h = _compte(client)
    _dossier_particulier_complet(client, h)
    doc_id = _piece(client.get("/api/dossier", headers=h).json(), "rib")["documents"][0]["id"]
    etat = client.delete(f"/api/dossier/documents/{doc_id}", headers=h).json()
    assert not etat["complet"] and "Relevé d'identité bancaire (RIB)" in etat["manquantes"]

    assert client.delete("/api/dossier", headers=h).status_code == 200
    assert client.get("/api/dossier", headers=h).json()["profil"] is None
    assert not any(f.is_file() for f in (tmp_path / "dossiers").rglob("*"))


def test_suppression_du_compte_efface_les_pieces(client, tmp_path):
    h = _compte(client)
    _dossier_particulier_complet(client, h)
    assert any(f.is_file() for f in (tmp_path / "dossiers").rglob("*"))
    client.request("DELETE", "/api/auth/me", headers=h, json={"password": PASSWORD})
    assert not any(f.is_file() for f in (tmp_path / "dossiers").rglob("*"))


# --- Dossier prêt pour la banque ---

def test_export_dossier_pret(client):
    h = _compte(client)
    _dossier_particulier_complet(client, h)
    r = client.get("/api/dossier/export", headers=h)
    assert r.headers["content-type"] == "application/zip"
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    noms = zf.namelist()
    assert "00_recapitulatif.txt" in noms and "01_identite.pdf" in noms
    assert {"02_bulletins_salaire_1.pdf", "02_bulletins_salaire_2.pdf", "02_bulletins_salaire_3.pdf"} <= set(noms)
    assert zf.read("01_identite.pdf") == PDF
    recap = zf.read("00_recapitulatif.txt").decode()
    assert "profil Particulier" in recap and "Dossier complet." in recap


# --- Candidatures ---

def test_postuler_exige_un_dossier_complet(client):
    h = _compte(client)
    annonce = charger_annonces_csv()[0]["id_source"]
    r = client.post("/api/candidatures", headers=h, json={"annonce_id": annonce})
    assert r.status_code == 400 and r.json()["detail"]["manquantes"]

    _dossier_particulier_complet(client, h)
    assert client.post("/api/candidatures", headers=h, json={"annonce_id": annonce}).status_code == 201
    assert client.post("/api/candidatures", headers=h, json={"annonce_id": annonce}).status_code == 409
    liste = client.get("/api/candidatures", headers=h).json()
    assert liste[0]["annonce_id"] == annonce and liste[0]["annonce"]["photos"]
    assert client.delete(f"/api/candidatures/{annonce}", headers=h).status_code == 200
    assert client.get("/api/candidatures", headers=h).json() == []


def test_postuler_annonce_inexistante(client):
    h = _compte(client)
    assert client.post("/api/candidatures", headers=h, json={"annonce_id": "nexiste-pas"}).status_code == 404
