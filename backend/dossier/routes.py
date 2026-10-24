# =============================================================================
# backend/dossier/routes.py — API dossier (/api/dossier) et candidatures (/api/candidatures)
# =============================================================================
# Sécurité des pièces (identité, bulletins, avis d'imposition, RIB, Kbis…) :
#   • compte connecté ET email vérifié pour toute opération ;
#   • fichier chiffré (Fernet) avant écriture dans data/dossiers/<user>/<id>,
#     nom d'origine chiffré en base, chemin jamais dérivé d'une saisie ;
#   • type contrôlé sur le contenu réel (PDF, JPEG, PNG), 10 Mo maximum ;
#   • lecture limitée au propriétaire (toutes les requêtes filtrent user_id) ;
#   • téléchargement en pièce jointe, sans cache ni interprétation par le navigateur ;
#   • suppression à la demande, et de tout le dossier avec le compte.
# =============================================================================

import io
import shutil
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel

from backend.auth import crypto
from backend.auth.db import connect
from backend.auth.likes import _annonces
from backend.auth.routes import get_current_user
from backend.dossier.pieces import PIECES, PROFILS, piece

ROOT = Path(__file__).resolve().parents[2]
DOSSIERS_DIR = ROOT / "data" / "dossiers"
MAX_TAILLE = 10 * 1024 * 1024
SIGNATURES = {b"%PDF-": ("application/pdf", ".pdf"), b"\xff\xd8\xff": ("image/jpeg", ".jpg"),
              b"\x89PNG\r\n\x1a\n": ("image/png", ".png")}
SANS_CACHE = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}

router = APIRouter(prefix="/api/dossier", tags=["dossier"])
candidatures_router = APIRouter(prefix="/api/candidatures", tags=["dossier"])


class ProfilIn(BaseModel):
    profil: Literal["particulier", "societe"]


class CandidatureIn(BaseModel):
    annonce_id: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def compte_verifie(user=Depends(get_current_user)):
    if not user["email_verified"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Adresse email non vérifiée.")
    return user


def _dossier_dir(user_id: int) -> Path:
    return DOSSIERS_DIR / str(int(user_id))


def supprimer_fichiers(user_id: int) -> None:
    """Efface les fichiers chiffrés d'un compte (suppression du dossier ou du compte)."""
    shutil.rmtree(_dossier_dir(user_id), ignore_errors=True)


def etat_dossier(user_id: int) -> dict:
    """Checklist du profil : documents déposés par pièce, pièces manquantes, complétude."""
    with connect() as conn:
        row = conn.execute("SELECT profil FROM dossiers WHERE user_id = ?", (user_id,)).fetchone()
        docs = conn.execute("SELECT * FROM documents WHERE user_id = ? ORDER BY created_at", (user_id,)).fetchall()
    profil = row["profil"] if row else None
    pieces = []
    for p in PIECES.get(profil, []):
        fichiers = [{"id": d["id"], "nom": crypto.decrypt(d["nom_enc"]), "mime": d["mime"], "taille": d["taille"],
                     "date_document": d["date_document"], "depose_le": d["created_at"]}
                    for d in docs if d["piece"] == p["id"]]
        pieces.append({**p, "documents": fichiers, "complete": len(fichiers) >= p["nombre"]})
    manquantes = [p["label"] for p in pieces if p["obligatoire"] and not p["complete"]]
    return {"profil": profil, "profil_label": PROFILS.get(profil), "pieces": pieces,
            "manquantes": manquantes, "complet": bool(profil) and not manquantes}


# --- Dossier ---

@router.get("")
def get_dossier(user=Depends(compte_verifie)) -> dict:
    return etat_dossier(user["id"])


@router.put("/profil")
def set_profil(data: ProfilIn, user=Depends(compte_verifie)) -> dict:
    """Particulier ou société. Les pièces déjà déposées pour l'autre profil sont conservées."""
    with connect() as conn:
        conn.execute("INSERT INTO dossiers (user_id, profil, maj) VALUES (?, ?, ?) "
                     "ON CONFLICT(user_id) DO UPDATE SET profil = excluded.profil, maj = excluded.maj",
                     (user["id"], data.profil, _now()))
    return etat_dossier(user["id"])


@router.post("/documents", status_code=status.HTTP_201_CREATED)
async def deposer(piece_id: str = Form(..., alias="piece"), fichier: UploadFile = File(...),
                  date_document: Optional[date] = Form(None), user=Depends(compte_verifie)) -> dict:
    etat = etat_dossier(user["id"])
    if not etat["profil"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choisissez d'abord votre profil (particulier ou société).")
    p = piece(etat["profil"], piece_id)
    if p is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pièce inconnue pour ce profil.")

    contenu = await fichier.read(MAX_TAILLE + 1)
    if len(contenu) > MAX_TAILLE:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fichier trop lourd (10 Mo maximum).")
    signature = next((v for sig, v in SIGNATURES.items() if contenu.startswith(sig)), None)
    if signature is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Formats acceptés : PDF, JPEG ou PNG.")

    if p.get("validite_jours"):
        if date_document is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Indiquez la date du document ({p['label']}).")
        if date_document > date.today() or date_document < date.today() - timedelta(days=p["validite_jours"]):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Document trop ancien : {p['label'].lower()}.")

    deja = next(x for x in etat["pieces"] if x["id"] == piece_id)["documents"]
    if p["nombre"] == 1 and deja:  # pièce unique : le nouveau fichier remplace l'ancien
        _supprimer_document(user["id"], deja[0]["id"])
    elif len(deja) >= p["nombre"]:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{p['nombre']} fichiers maximum : supprimez-en un avant d'en ajouter.")

    doc_id = crypto.new_token()
    dossier = _dossier_dir(user["id"])
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / doc_id).write_bytes(crypto.encrypt_bytes(contenu))
    nom = Path(fichier.filename or f"{piece_id}{signature[1]}").name[:120]
    with connect() as conn:
        conn.execute(
            "INSERT INTO documents (id, user_id, piece, nom_enc, mime, taille, date_document, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (doc_id, user["id"], piece_id, crypto.encrypt(nom), signature[0], len(contenu),
             date_document.isoformat() if date_document else None, _now()),
        )
    return etat_dossier(user["id"])


def _supprimer_document(user_id: int, doc_id: str) -> bool:
    with connect() as conn:
        cur = conn.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id))
    if cur.rowcount:
        (_dossier_dir(user_id) / doc_id).unlink(missing_ok=True)
    return bool(cur.rowcount)


@router.get("/documents/{doc_id}")
def telecharger(doc_id: str, user=Depends(compte_verifie)) -> Response:
    with connect() as conn:
        d = conn.execute("SELECT * FROM documents WHERE id = ? AND user_id = ?", (doc_id, user["id"])).fetchone()
    chemin = _dossier_dir(user["id"]) / doc_id
    if not d or not chemin.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable.")
    nom = crypto.decrypt(d["nom_enc"]).replace('"', "")
    return Response(crypto.decrypt_bytes(chemin.read_bytes()), media_type=d["mime"],
                    headers={**SANS_CACHE, "Content-Disposition": f'attachment; filename="{nom}"'})


@router.delete("/documents/{doc_id}")
def supprimer_document(doc_id: str, user=Depends(compte_verifie)) -> dict:
    if not _supprimer_document(user["id"], doc_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable.")
    return etat_dossier(user["id"])


@router.delete("")
def supprimer_dossier(user=Depends(compte_verifie)) -> dict:
    """Efface toutes les pièces et le profil (droit à l'effacement)."""
    with connect() as conn:
        conn.execute("DELETE FROM documents WHERE user_id = ?", (user["id"],))
        conn.execute("DELETE FROM dossiers WHERE user_id = ?", (user["id"],))
    supprimer_fichiers(user["id"])
    return {"message": "Dossier et pièces supprimés."}


@router.get("/export")
def exporter(user=Depends(compte_verifie)) -> Response:
    """« Dossier prêt » pour la banque : ZIP des pièces rangées + récapitulatif."""
    etat = etat_dossier(user["id"])
    if not etat["profil"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choisissez d'abord votre profil.")
    lignes = [f"DOSSIER DE FINANCEMENT — profil {etat['profil_label']}",
              f"Préparé le {date.today().strftime('%d/%m/%Y')}", ""]
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, p in enumerate(etat["pieces"], start=1):
            statut = "fournie" if p["complete"] else ("MANQUANTE" if p["obligatoire"] else "non fournie (facultative)")
            lignes.append(f"[{'x' if p['complete'] else ' '}] {p['label']} — {statut}")
            for j, d in enumerate(p["documents"], start=1):
                extension = Path(d["nom"]).suffix or ".pdf"
                contenu = crypto.decrypt_bytes((_dossier_dir(user["id"]) / d["id"]).read_bytes())
                zf.writestr(f"{i:02d}_{p['id']}{f'_{j}' if p['nombre'] > 1 else ''}{extension}", contenu)
        lignes += ["", "Dossier complet." if etat["complet"] else "Pièces manquantes : " + ", ".join(etat["manquantes"])]
        zf.writestr("00_recapitulatif.txt", "\n".join(lignes))
    return Response(tampon.getvalue(), media_type="application/zip",
                    headers={**SANS_CACHE, "Content-Disposition": 'attachment; filename="dossier_financement.zip"'})


# --- Candidatures ---

@candidatures_router.get("")
def mes_candidatures(user=Depends(compte_verifie)) -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM candidatures WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)).fetchall()
    return [{"annonce_id": r["annonce_id"], "statut": r["statut"], "profil": r["profil"], "envoyee_le": r["created_at"],
             "annonce": _annonces().get(r["annonce_id"])} for r in rows]


@candidatures_router.post("", status_code=status.HTTP_201_CREATED)
def postuler(data: CandidatureIn, user=Depends(compte_verifie)) -> dict:
    """Postuler à une annonce : dossier complet exigé (sinon 400 avec les pièces manquantes)."""
    if data.annonce_id not in _annonces():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Annonce introuvable.")
    etat = etat_dossier(user["id"])
    if not etat["complet"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {
            "message": "Votre dossier est incomplet.", "manquantes": etat["manquantes"] or ["Choix du profil"]})
    with connect() as conn:
        if conn.execute("SELECT 1 FROM candidatures WHERE user_id = ? AND annonce_id = ?", (user["id"], data.annonce_id)).fetchone():
            raise HTTPException(status.HTTP_409_CONFLICT, "Vous avez déjà postulé à cette annonce.")
        conn.execute("INSERT INTO candidatures (user_id, annonce_id, profil, created_at) VALUES (?, ?, ?, ?)",
                     (user["id"], data.annonce_id, etat["profil"], _now()))
    return {"message": "Candidature envoyée.", "annonce_id": data.annonce_id, "statut": "envoyee"}


@candidatures_router.delete("/{annonce_id}")
def retirer_candidature(annonce_id: str, user=Depends(compte_verifie)) -> dict:
    with connect() as conn:
        cur = conn.execute("DELETE FROM candidatures WHERE user_id = ? AND annonce_id = ?", (user["id"], annonce_id))
    if not cur.rowcount:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucune candidature pour cette annonce.")
    return {"message": "Candidature retirée.", "annonce_id": annonce_id}
