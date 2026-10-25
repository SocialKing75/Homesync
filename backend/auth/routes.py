# =============================================================================
# backend/auth/routes.py — API comptes : /api/auth/*
# =============================================================================
# Sécurité :
#   • mots de passe scrypt, politique de complexité, verrouillage après
#     MAX_FAILED_ATTEMPTS échecs (LOCK_MINUTES minutes) ;
#   • jetons de session aléatoires (Bearer), stockés hachés, révocables ;
#   • email et nom chiffrés en base ;
#   • réponses identiques que le compte existe ou non (inscription, mot de
#     passe oublié) pour ne pas révéler les adresses inscrites.
# =============================================================================

import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from backend.auth import crypto, mailer
from backend.auth.db import connect

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_TTL = timedelta(hours=int(os.getenv("SESSION_TTL_HOURS", "168")))  # 7 jours
VERIFY_TTL = timedelta(hours=24)
RESET_TTL = timedelta(hours=1)
MAX_FAILED_ATTEMPTS = 5
MAX_PASSWORD = 128          # au-delà, scrypt sur une entrée énorme = déni de service
MAX_EMAILS = 3              # emails de compte (vérification, reset) par adresse…
EMAILS_WINDOW_S = 15 * 60   # …sur cette fenêtre
_envois: dict[str, list[float]] = {}  # en mémoire, par instance
LOCK_MINUTES = 15

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# Hash factice : la vérification d'un email inconnu prend le même temps qu'un vrai
_DUMMY_HASH = crypto.hash_password("compte-inexistant")

MSG_INSCRIPTION = "Si l'adresse est valide, un email de vérification vient d'être envoyé."
MSG_RESET = "Si un compte existe pour cette adresse, un email de réinitialisation vient d'être envoyé."


# --- Modèles ---

class RegisterIn(BaseModel):
    email: str
    password: str
    nom: Optional[str] = None


class LoginIn(BaseModel):
    email: str
    password: str


class EmailIn(BaseModel):
    email: str


class TokenIn(BaseModel):
    token: str


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountIn(BaseModel):
    password: str


# --- Helpers ---

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def valider_mot_de_passe(password: str) -> None:
    """De 10 à MAX_PASSWORD caractères, une minuscule, une majuscule et un chiffre."""
    if len(password) > MAX_PASSWORD:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Mot de passe trop long ({MAX_PASSWORD} caractères maximum).")
    if (len(password) < 10 or not re.search(r"[a-z]", password)
            or not re.search(r"[A-Z]", password) or not re.search(r"\d", password)):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Mot de passe trop faible : 10 caractères minimum, avec une minuscule, une majuscule et un chiffre.",
        )


def _envoi_autorise(email: str) -> bool:
    """Au plus MAX_EMAILS emails de compte par adresse sur EMAILS_WINDOW_S : empêche d'inonder
    une boîte. Au-delà, la réponse HTTP est identique (rien ne révèle le blocage)."""
    now = time.time()
    cle = crypto.email_lookup_hash(email)
    recents = [t for t in _envois.get(cle, []) if now - t < EMAILS_WINDOW_S]
    autorise = len(recents) < MAX_EMAILS
    _envois[cle] = recents + [now] if autorise else recents
    return autorise


def _valider_email(email: str) -> str:
    email = crypto.normalize_email(email)
    if not EMAIL_RE.match(email) or len(email) > 254:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Adresse email invalide.")
    return email


def _user_par_email(conn, email: str):
    return conn.execute("SELECT * FROM users WHERE email_hash = ?", (crypto.email_lookup_hash(email),)).fetchone()


def _creer_token(conn, user_id: int, purpose: str, ttl: timedelta) -> str:
    # Un seul jeton valide par usage : les précédents sont invalidés
    conn.execute("UPDATE tokens SET used = 1 WHERE user_id = ? AND purpose = ?", (user_id, purpose))
    token = crypto.new_token()
    conn.execute(
        "INSERT INTO tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)",
        (crypto.hash_token(token), user_id, purpose, _iso(_now() + ttl)),
    )
    return token


def _consommer_token(conn, token: str, purpose: str):
    row = conn.execute(
        "SELECT * FROM tokens WHERE token_hash = ? AND purpose = ?", (crypto.hash_token(token), purpose)
    ).fetchone()
    if not row or row["used"] or datetime.fromisoformat(row["expires_at"]) < _now():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lien invalide ou expiré.")
    conn.execute("UPDATE tokens SET used = 1 WHERE token_hash = ?", (row["token_hash"],))
    return row


def _profil(user) -> dict:
    return {
        "id": user["id"],
        "email": crypto.decrypt(user["email_enc"]),
        "nom": crypto.decrypt(user["nom_enc"]),
        "email_verifie": bool(user["email_verified"]),
        "cree_le": user["created_at"],
    }


def get_current_user(authorization: Optional[str] = Header(None)):
    """Dépendance FastAPI : utilisateur de la session Bearer, sinon 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification requise.",
                            headers={"WWW-Authenticate": "Bearer"})
    token_hash = crypto.hash_token(authorization.split(" ", 1)[1].strip())
    with connect() as conn:
        row = conn.execute(
            "SELECT u.*, s.expires_at AS session_expires, s.token_hash AS session_hash "
            "FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
            (token_hash,),
        ).fetchone()
        if not row or datetime.fromisoformat(row["session_expires"]) < _now():
            if row:
                conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
                conn.commit()
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session invalide ou expirée.",
                                headers={"WWW-Authenticate": "Bearer"})
    return row


def get_optional_user(authorization: Optional[str] = Header(None)):
    """Comme get_current_user, mais None pour un visiteur (jeton absent ou invalide)."""
    if not authorization:
        return None
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None


# --- Inscription & vérification email ---

@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
def register(data: RegisterIn) -> dict:
    email = _valider_email(data.email)
    valider_mot_de_passe(data.password)
    if not mailer.emails_actifs():
        return _register_sans_email(email, data)
    with connect() as conn:
        user = _user_par_email(conn, email)
        if user is None:
            cur = conn.execute(
                "INSERT INTO users (email_hash, email_enc, nom_enc, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (crypto.email_lookup_hash(email), crypto.encrypt(email), crypto.encrypt(data.nom),
                 crypto.hash_password(data.password), _iso(_now())),
            )
            token = _creer_token(conn, cur.lastrowid, "verify_email", VERIFY_TTL)
        elif not user["email_verified"]:
            # Compte jamais activé : la dernière inscription fixe le mot de passe. Sinon un
            # tiers qui aurait inscrit l'adresse avant son titulaire garderait le sien et
            # se connecterait au compte dès que le vrai titulaire clique sur le lien.
            conn.execute("UPDATE users SET password_hash = ?, nom_enc = ? WHERE id = ?",
                         (crypto.hash_password(data.password), crypto.encrypt(data.nom), user["id"]))
            token = _creer_token(conn, user["id"], "verify_email", VERIFY_TTL)
        else:
            # Compte déjà actif : rien à envoyer, même réponse et même durée (un scrypt,
            # comme les deux autres branches) pour ne pas révéler l'adresse
            crypto.verify_password(data.password, _DUMMY_HASH)
            token = None
    if token:
        mailer.envoyer_verification(email, token)
    return _avec_lien_dev({"message": MSG_INSCRIPTION}, token, "/verifier-email")


def _register_sans_email(email: str, data: RegisterIn) -> dict:
    """EMAILS=off : le compte est actif tout de suite (personne ne peut prouver posséder l'adresse).
    Un compte jamais activé est repris par la nouvelle inscription, comme dans le parcours avec email."""
    with connect() as conn:
        user = _user_par_email(conn, email)
        if user is None:
            conn.execute(
                "INSERT INTO users (email_hash, email_enc, nom_enc, password_hash, created_at, email_verified) VALUES (?, ?, ?, ?, ?, 1)",
                (crypto.email_lookup_hash(email), crypto.encrypt(email), crypto.encrypt(data.nom),
                 crypto.hash_password(data.password), _iso(_now())),
            )
        elif not user["email_verified"]:
            conn.execute("UPDATE users SET password_hash = ?, nom_enc = ?, email_verified = 1 WHERE id = ?",
                         (crypto.hash_password(data.password), crypto.encrypt(data.nom), user["id"]))
        else:
            crypto.verify_password(data.password, _DUMMY_HASH)
    return {"message": "Compte créé. Vous pouvez vous connecter.", "compte_actif": True}


def _emails_requis() -> None:
    if not mailer.emails_actifs():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Les emails sont désactivés sur ce site : cette action n'est pas disponible.")


def _avec_lien_dev(reponse: dict, token: Optional[str], chemin: str) -> dict:
    """APP_ENV=dev sans SMTP : renvoie le lien de l'email pour tester sans boîte mail.
    Jamais en production (APP_ENV absent) : le lien prouve la possession de l'adresse."""
    if token and os.getenv("APP_ENV") == "dev" and not os.getenv("SMTP_USER"):
        reponse["dev_lien"] = mailer.frontend_url(f"{chemin}?token={token}")
    return reponse


@router.post("/verify-email")
def verify_email(data: TokenIn) -> dict:
    with connect() as conn:
        row = _consommer_token(conn, data.token, "verify_email")
        conn.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (row["user_id"],))
    return {"message": "Adresse email vérifiée. Vous pouvez vous connecter."}


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED)
def resend_verification(data: EmailIn) -> dict:
    _emails_requis()
    email = crypto.normalize_email(data.email)
    with connect() as conn:
        user = _user_par_email(conn, email)
        renvoyer = user and not user["email_verified"] and _envoi_autorise(email)
        token = _creer_token(conn, user["id"], "verify_email", VERIFY_TTL) if renvoyer else None
    if token:
        mailer.envoyer_verification(email, token)
    return _avec_lien_dev({"message": MSG_INSCRIPTION}, token, "/verifier-email")


# --- Connexion / sessions ---

@router.post("/login")
def login(data: LoginIn) -> dict:
    email = crypto.normalize_email(data.email)
    erreur = HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ou mot de passe incorrect.")
    if len(data.password) > MAX_PASSWORD:
        raise erreur  # aucun compte n'a un tel mot de passe : inutile de lancer scrypt dessus
    with connect() as conn:
        user = _user_par_email(conn, email)
        if user is None:
            crypto.verify_password(data.password, _DUMMY_HASH)
            raise erreur

        if user["locked_until"] and datetime.fromisoformat(user["locked_until"]) > _now():
            raise HTTPException(status.HTTP_423_LOCKED,
                                f"Compte temporairement verrouillé après {MAX_FAILED_ATTEMPTS} échecs. Réessayez plus tard.")

        if not crypto.verify_password(data.password, user["password_hash"]):
            # Incrément atomique : des essais envoyés en parallèle liraient tous le même
            # compteur et contourneraient le verrouillage
            echecs = conn.execute(
                "UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ? RETURNING failed_attempts",
                (user["id"],),
            ).fetchone()[0]
            if echecs >= MAX_FAILED_ATTEMPTS:
                conn.execute("UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?",
                             (_iso(_now() + timedelta(minutes=LOCK_MINUTES)), user["id"]))
            conn.commit()  # connect() annule la transaction quand l'exception sort du bloc
            raise erreur

        if not user["email_verified"]:
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                "Adresse email non vérifiée. Consultez vos emails ou demandez un nouveau lien.")

        conn.execute("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?", (user["id"],))
        token = crypto.new_token()
        expires = _now() + SESSION_TTL
        conn.execute("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                     (crypto.hash_token(token), user["id"], _iso(_now()), _iso(expires)))
    return {"access_token": token, "token_type": "bearer", "expires_at": _iso(expires), "user": _profil(user)}


@router.post("/logout")
def logout(user=Depends(get_current_user)) -> dict:
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (user["session_hash"],))
    return {"message": "Déconnecté."}


@router.post("/logout-all")
def logout_all(user=Depends(get_current_user)) -> dict:
    """Révoque toutes les sessions du compte (tous les appareils)."""
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
    return {"message": "Toutes les sessions ont été fermées."}


@router.get("/me")
def me(user=Depends(get_current_user)) -> dict:
    return _profil(user)


# --- Mot de passe ---

@router.post("/change-password")
def change_password(data: ChangePasswordIn, user=Depends(get_current_user)) -> dict:
    if not crypto.verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Mot de passe actuel incorrect.")
    valider_mot_de_passe(data.new_password)
    with connect() as conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (crypto.hash_password(data.new_password), user["id"]))
        # Les autres appareils sont déconnectés, la session courante est conservée
        conn.execute("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", (user["id"], user["session_hash"]))
    return {"message": "Mot de passe modifié. Les autres sessions ont été fermées."}


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(data: EmailIn) -> dict:
    _emails_requis()
    email = crypto.normalize_email(data.email)
    with connect() as conn:
        user = _user_par_email(conn, email)
        token = _creer_token(conn, user["id"], "reset_password", RESET_TTL) if user and _envoi_autorise(email) else None
    if token:
        mailer.envoyer_reset(email, token)
    return {"message": MSG_RESET}


@router.post("/reset-password")
def reset_password(data: ResetPasswordIn) -> dict:
    valider_mot_de_passe(data.new_password)
    with connect() as conn:
        row = _consommer_token(conn, data.token, "reset_password")
        # Le lien reçu par email prouve aussi la possession de l'adresse
        conn.execute(
            "UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL, email_verified = 1 WHERE id = ?",
            (crypto.hash_password(data.new_password), row["user_id"]),
        )
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["user_id"],))
    return {"message": "Mot de passe réinitialisé. Vous pouvez vous connecter."}


# --- Suppression du compte ---

@router.delete("/me")
def delete_account(data: DeleteAccountIn, user=Depends(get_current_user)) -> dict:
    """Supprime définitivement le compte, ses sessions et ses likes (mot de passe requis)."""
    if not crypto.verify_password(data.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Mot de passe incorrect.")
    email = crypto.decrypt(user["email_enc"])
    with connect() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))  # cascade : sessions, tokens, likes, dossier
    from backend.dossier.routes import supprimer_fichiers  # import local : dossier dépend d'auth
    supprimer_fichiers(user["id"])  # pièces chiffrées sur disque
    mailer.envoyer_compte_supprime(email)
    return {"message": "Compte et données supprimés."}
