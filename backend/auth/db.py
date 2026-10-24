# =============================================================================
# backend/auth/db.py — Base SQLite des comptes, sessions et likes
# =============================================================================
# Fichier : variable APP_DB_PATH (défaut data/app.db, non versionné).
# Les données personnelles (email, nom) sont stockées chiffrées — voir crypto.py.
# =============================================================================

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email_hash      TEXT NOT NULL UNIQUE,      -- HMAC de l'email : recherche sans le stocker en clair
    email_enc       TEXT NOT NULL,             -- email chiffré (Fernet)
    nom_enc         TEXT,                      -- nom chiffré (Fernet)
    password_hash   TEXT NOT NULL,             -- scrypt + sel
    email_verified  INTEGER NOT NULL DEFAULT 0,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    TEXT,
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,              -- SHA-256 du jeton (jamais le jeton lui-même)
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
    token_hash  TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose     TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    expires_at  TEXT NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS likes (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    annonce_id  TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('classique', 'gold')),
    created_at  TEXT NOT NULL,
    PRIMARY KEY (user_id, annonce_id)
);

-- Chatbot : sessions et recherches survivent aux redémarrages (--reload)
CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id  TEXT PRIMARY KEY,
    etat        TEXT NOT NULL,             -- critères, messages utiles (données perso masquées), question en attente
    maj         REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_searches (
    search_id   TEXT PRIMARY KEY,
    session_id  TEXT,
    criteres    TEXT NOT NULL,
    annonce_ids TEXT NOT NULL,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL
);

-- Dossier de candidature : profil, pièces déposées (fichiers chiffrés sur disque), candidatures
CREATE TABLE IF NOT EXISTS dossiers (
    user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    profil      TEXT NOT NULL CHECK (profil IN ('particulier', 'societe')),
    maj         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    id            TEXT PRIMARY KEY,        -- aléatoire : aussi le nom du fichier chiffré sur disque
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    piece         TEXT NOT NULL,
    nom_enc       TEXT NOT NULL,           -- nom d'origine, chiffré
    mime          TEXT NOT NULL,
    taille        INTEGER NOT NULL,
    date_document TEXT,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidatures (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    annonce_id  TEXT NOT NULL,
    profil      TEXT NOT NULL,
    statut      TEXT NOT NULL DEFAULT 'envoyee',
    created_at  TEXT NOT NULL,
    PRIMARY KEY (user_id, annonce_id)
);

CREATE TABLE IF NOT EXISTS dislikes (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    annonce_id  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (user_id, annonce_id)
);
"""


def db_path() -> Path:
    return Path(os.environ.get("APP_DB_PATH", str(ROOT / "data" / "app.db")))


@contextmanager
def connect():
    """Connexion SQLite avec clés étrangères actives ; commit à la sortie, rollback sur erreur."""
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
