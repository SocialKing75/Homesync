# =============================================================================
# backend/auth/crypto.py — Hachage des mots de passe, jetons, chiffrement
# =============================================================================
# - Mots de passe : scrypt (stdlib) + sel aléatoire, comparaison à temps constant.
# - Jetons (session, vérification, reset) : aléatoires, seul leur SHA-256 est stocké.
# - Données personnelles : chiffrées avec Fernet (AES-128-CBC + HMAC-SHA256).
#   Clé maîtresse : variable APP_SECRET_KEY. À défaut (dev), une clé est générée
#   une fois dans data/.secret_key (non versionné).
# =============================================================================

import base64
import hashlib
import hmac
import os
import secrets
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet

ROOT = Path(__file__).resolve().parents[2]
SECRET_FILE = ROOT / "data" / ".secret_key"

SCRYPT_N, SCRYPT_R, SCRYPT_P = 2 ** 14, 8, 1


@lru_cache(maxsize=1)
def _master_key() -> bytes:
    key = os.environ.get("APP_SECRET_KEY")
    if key:
        return key.encode()
    if not SECRET_FILE.exists():
        SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
        SECRET_FILE.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    return SECRET_FILE.read_text(encoding="utf-8").strip().encode()


def _derive(label: bytes) -> bytes:
    return hashlib.sha256(label + b":" + _master_key()).digest()


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    return Fernet(base64.urlsafe_b64encode(_derive(b"chiffrement")))


# --- Mots de passe ---

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    return "scrypt${}${}${}${}${}".format(
        SCRYPT_N, SCRYPT_R, SCRYPT_P,
        base64.b64encode(salt).decode(), base64.b64encode(digest).decode(),
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        _, n, r, p, salt_b64, digest_b64 = stored.split("$")
        digest = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt_b64),
            n=int(n), r=int(r), p=int(p),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest, base64.b64decode(digest_b64))


# --- Jetons ---

def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# --- Données personnelles ---

def normalize_email(email: str) -> str:
    return email.strip().casefold()


def email_lookup_hash(email: str) -> str:
    """Empreinte déterministe de l'email (HMAC) pour la recherche en base."""
    return hmac.new(_derive(b"recherche-email"), normalize_email(email).encode(), hashlib.sha256).hexdigest()


def encrypt(value: str | None) -> str | None:
    return _fernet().encrypt(value.encode()).decode() if value else None


def decrypt(value: str | None) -> str | None:
    return _fernet().decrypt(value.encode()).decode() if value else None


def encrypt_bytes(data: bytes) -> bytes:
    """Fichiers du dossier (pièces d'identité, bulletins…) : chiffrés avant écriture disque."""
    return _fernet().encrypt(data)


def decrypt_bytes(data: bytes) -> bytes:
    return _fernet().decrypt(data)
