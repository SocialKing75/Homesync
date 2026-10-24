# =============================================================================
# backend/chat/agent.py — Agent de recherche immobilière (slot filling + RAG)
# =============================================================================
# À chaque message, l'agent complète les critères de la session (villes — 3 au
# plus —, type, pièces, budget, quartier, surface, objectif). Il pose d'abord
# la question des villes, puis du type et du budget (une fois chacune ;
# « peu importe » passe la question). Ensuite il filtre les annonces :
# recherche sémantique ChromaDB sur tout ce que l'utilisateur a écrit, puis
# critères stricts, puis assouplissement si rien ne correspond. Les annonces
# trouvées sont enregistrées sous un search_id ; leur détail n'est servi
# qu'aux comptes connectés. Chaque message passe d'abord par garde_fous.py.
# =============================================================================

from __future__ import annotations

import json
import re
import time
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache

from backend.auth import crypto
from backend.auth.db import connect
from backend.chat import garde_fous
from backend.chat.garde_fous import _norm
from backend.loaders.annonces_loader import ANNONCES_CSV, charger_annonces_csv
from backend.rag.assistant import indexer_si_vide
from backend.rag.vector_store import search_similar

MAX_RESULTS = 30
MAX_VILLES = 3
SESSION_TTL_S = 24 * 3600  # sessions et recherches : tables chat_* de backend/auth/db.py

SKIP_RE = re.compile(r"\b(peu importe|pas important|indifferent|n'importe|aucune idee|je ne sais pas|passe)\b")

SUGGESTIONS_TYPE = ["Appartement", "Maison", "Peu importe"]
SUGGESTIONS_BUDGET = ["200 000 €", "300 000 €", "450 000 €", "Peu importe"]
SUGGESTIONS_RESULTATS = ["Affiner ma recherche"]  # création de compte : boutons de la carte d'aperçu
SUGGESTIONS_AUCUN = ["Augmenter le budget", "Peu importe le nombre de pièces", "Peu importe le quartier"]


# --- Référentiels construits depuis les annonces ---
# Recalculés quand le CSV change (ingestion, export), sans redémarrer l'API.

@lru_cache(maxsize=1)
def _referentiel(_version: int) -> dict:
    par_id = {a["id_source"]: a for a in charger_annonces_csv()}
    villes = [v for v, _ in Counter(a["ville"] for a in par_id.values()).most_common()]
    # « aix en provence », « aix-en-provence » et « Aix-en-Provence » désignent la même ville
    motifs = [(re.compile(r"\b" + r"[\s-]+".join(map(re.escape, re.split(r"[\s-]+", _norm(v)))) + r"\b"), v)
              for v in villes]
    # « mourillon » → {("Toulon", "Le Mourillon - La Mitre - Fort Lamalgue")} (chaque partie du nom compte)
    noms_villes = {_norm(v) for v in villes}
    quartiers: dict[str, set[tuple[str, str]]] = {}
    for a in par_id.values():
        for partie in (a.get("quartier") or "").split(" - "):
            mot = re.sub(r"^(le|la|les|l')\s*", "", _norm(partie).strip())
            if len(mot) >= 4 and not any(mot.startswith(v) for v in noms_villes):
                quartiers.setdefault(mot, set()).add((a["ville"], a["quartier"]))
    return {"par_id": par_id, "villes": villes, "motifs": motifs, "quartiers": quartiers}


def _ref() -> dict:
    return _referentiel(ANNONCES_CSV.stat().st_mtime_ns if ANNONCES_CSV.exists() else 0)


def _annonces_par_id() -> dict[str, dict]:
    return _ref()["par_id"]


def villes_disponibles() -> list[str]:
    """Villes présentes dans les annonces, de la mieux couverte à la moins couverte."""
    return _ref()["villes"]


# --- Extraction des critères ---

def _montant(nombre: str, suffixe: str) -> float:
    valeur = float(re.sub(r"[\s ]", "", nombre).replace(",", "."))
    if suffixe.startswith("k"):
        valeur *= 1000
    elif suffixe.startswith("m"):
        valeur *= 1_000_000
    elif suffixe.startswith("000"):
        valeur *= 1000
    return valeur


def extraire_villes(texte: str) -> list[str]:
    t = _norm(texte)
    return [ville for motif, ville in _ref()["motifs"] if motif.search(t)]


def extraire_criteres(texte: str, attendu: str | None = None, villes: list[str] | None = None) -> dict:
    """Critères explicites d'un message. `attendu` = question posée juste avant ;
    `villes` = villes déjà choisies (limite la recherche de quartiers)."""
    t = _norm(texte)
    criteres: dict = {}

    trouvees = extraire_villes(texte)
    if trouvees:
        criteres["villes"] = trouvees

    if re.search(r"\bmaisons?\b|\bvillas?\b", t):
        criteres["type_bien"] = "Maison"
    elif re.search(r"\bappart(ement)?s?\b|\bstudios?\b|\bt[1-6]\b", t):
        criteres["type_bien"] = "Appartement"

    pieces = re.search(r"\bt\s?([1-6])\b|\b([1-6])\s*pieces?\b", t)
    if pieces:
        criteres["pieces"] = int(pieces.group(1) or pieces.group(2))
    elif re.search(r"\bstudio\b", t):
        criteres["pieces"] = 1

    surface = re.search(r"(\d{2,3})\s*(?:m2|m²|m\b|metres? carres)", t)
    if surface:
        criteres["surface_min"] = float(surface.group(1))

    # « m » seul = mètres (« 65 m ») : le million doit être explicite (« 1,2 million », « 1 M€ »)
    budget = re.search(r"(\d[\d\s .,]*\d|\d)\s*(k|millions?\b|m€|meur|keur|000\s*e|\s*(?:€|e\b|euros?))", t)
    if budget:
        valeur = _montant(budget.group(1), budget.group(2).strip())
        if valeur >= 20_000:
            criteres["budget_max"] = valeur
    elif attendu == "budget":
        nombre = re.fullmatch(r"\s*(\d[\d\s.]*)\s*", t)
        if nombre:
            valeur = float(re.sub(r"[\s.]", "", nombre.group(1)))
            criteres["budget_max"] = valeur * 1000 if valeur < 5000 else valeur

    perimetre = set(villes or []) | set(trouvees)
    quartiers = {q for mot, lieux in _ref()["quartiers"].items() if re.search(rf"\b{re.escape(mot)}\b", t)
                 for ville, q in lieux if not perimetre or ville in perimetre}
    if quartiers:
        criteres["quartiers"] = sorted(quartiers)

    if re.search(r"\b(investi|investissement|locatif|rentab|louer)", t):
        criteres["objectif"] = "investissement"
    elif re.search(r"\b(habiter|residence principale|y vivre|famille)\b", t):
        criteres["objectif"] = "residence principale"

    return criteres


def relacher(texte: str, c: dict) -> bool:
    """Suggestions « aucun résultat » : élargit le critère demandé. True si un critère a changé."""
    t = _norm(texte)
    if "augmenter le budget" in t and c.get("budget_max"):
        c["budget_max"] = round(c["budget_max"] * 1.2, -3)
        return True
    for motif, cle in ((r"peu importe le nombre de pieces", "pieces"), (r"peu importe le quartier", "quartiers")):
        if re.search(motif, t) and c.pop(cle, None) is not None:
            return True
    return False


def resume_criteres(c: dict) -> str:
    morceaux = []
    if c.get("villes"):
        morceaux.append(", ".join(c["villes"]))
    if c.get("type_bien"):
        morceaux.append(c["type_bien"] + (f" T{c['pieces']}" if c.get("pieces") else ""))
    elif c.get("pieces"):
        morceaux.append(f"T{c['pieces']}")
    if c.get("quartiers"):
        morceaux.append(", ".join(q.split(" - ")[0] for q in c["quartiers"][:3]))
    if c.get("budget_max"):
        morceaux.append(f"≤ {c['budget_max']:,.0f} €".replace(",", " "))
    if c.get("surface_min"):
        morceaux.append(f"≥ {c['surface_min']:.0f} m²")
    if c.get("objectif"):
        morceaux.append(c["objectif"])
    return " · ".join(morceaux) or "toutes les villes"


# --- Filtrage des annonces ---

def _respecte(a: dict, c: dict, *, quartier: bool = True, marge_budget: float = 1.0) -> bool:
    if c.get("villes") and a.get("ville") not in c["villes"]:
        return False
    if c.get("type_bien") and not str(a.get("type", "")).startswith(c["type_bien"]):
        return False
    if c.get("pieces") and a.get("nb_pieces") != c["pieces"]:
        return False
    if c.get("budget_max") and (a.get("prix") or 0) > c["budget_max"] * marge_budget:
        return False
    if c.get("surface_min") and (a.get("surface") or 0) < c["surface_min"]:
        return False
    if quartier and c.get("quartiers") and a.get("quartier") not in c["quartiers"]:
        return False
    return True


def rechercher(c: dict, requete: str, exclure: set[str] = frozenset()) -> tuple[list[dict], str | None]:
    """Annonces classées par proximité sémantique, filtrées par critères.

    `exclure` : annonces dislikées par l'utilisateur connecté.
    Retourne (annonces, assouplissement) — assouplissement décrit le critère
    élargi quand la recherche stricte ne donne rien.
    """
    indexer_si_vide()
    par_id = _annonces_par_id()
    proches = search_similar(requete or resume_criteres(c), n=len(par_id))
    ordre = [b.get("id_source") for b in proches if b.get("id_source") in par_id]
    vus = set(ordre)
    ordre += [i for i in par_id if i not in vus]  # sécurité si l'index est incomplet
    candidates = [par_id[i] for i in ordre if i not in exclure]

    for options, note in (
        ({}, None),
        ({"quartier": False}, "j'ai élargi aux quartiers voisins"),
        ({"quartier": False, "marge_budget": 1.10}, "j'ai élargi aux quartiers voisins et à +10 % de budget"),
    ):
        trouvees = [a for a in candidates if _respecte(a, c, **options)]
        if trouvees:
            return trouvees[:MAX_RESULTS], note
    return [], None


def enregistrer_recherche(session_id: str, c: dict, annonces: list[dict], texte: str = "") -> str:
    """`texte` : ce que l'utilisateur a écrit (données perso déjà masquées), pour le matching."""
    search_id = crypto.new_token()
    with connect() as conn:
        conn.execute(
            "INSERT INTO chat_searches (search_id, session_id, criteres, annonce_ids, created_at) VALUES (?, ?, ?, ?, ?)",
            (search_id, session_id, json.dumps({**c, "texte": texte[:500]}, ensure_ascii=False),
             json.dumps([a["id_source"] for a in annonces]), datetime.now(timezone.utc).isoformat()),
        )
    return search_id


def charger_recherche(search_id: str, user_id: int, exclure: set[str] = frozenset(), gouts: str = "") -> dict | None:
    """Résultats complets d'une recherche (hors `exclure`), classés par score de matching
    (champ `match` de chaque annonce) ; rattache la recherche au compte qui la consulte."""
    with connect() as conn:
        row = conn.execute("SELECT * FROM chat_searches WHERE search_id = ?", (search_id,)).fetchone()
        if not row:
            return None
        if row["user_id"] is None:
            conn.execute("UPDATE chat_searches SET user_id = ? WHERE search_id = ?", (user_id, search_id))
    par_id = _annonces_par_id()
    annonces = [par_id[i] for i in json.loads(row["annonce_ids"]) if i in par_id and i not in exclure]
    criteres = json.loads(row["criteres"])
    from backend.matching.scoring import matcher  # import local : matching dépend du chat (normalisation)
    return {"search_id": search_id, "criteres": criteres, "annonces": matcher(criteres, annonces, gouts)}


def _apercu(annonces: list[dict]) -> dict:
    """Aperçu affiché avant création de compte : ni prix exacts, ni liens, ni photos."""
    prix = [a["prix"] for a in annonces if a.get("prix")]
    return {
        "count": len(annonces),
        "prix_min": min(prix) if prix else None,
        "prix_max": max(prix) if prix else None,
        "items": [{"type": a.get("type"), "ville": a.get("ville"), "quartier": a.get("quartier"), "surface": a.get("surface")}
                  for a in annonces[:3]],
    }


# --- Conversation ---

def _charger_session(session_id: str) -> dict:
    with connect() as conn:
        conn.execute("DELETE FROM chat_sessions WHERE maj < ?", (time.time() - SESSION_TTL_S,))
        row = conn.execute("SELECT etat FROM chat_sessions WHERE session_id = ?", (session_id,)).fetchone()
    s = json.loads(row["etat"]) if row else {}
    s.setdefault("criteres", {})
    s.setdefault("textes", [])
    s.setdefault("attendu", None)
    s["demandes"] = set(s.get("demandes", []))
    s.setdefault("nb", 0)
    return s


def _sauver_session(session_id: str, s: dict) -> None:
    etat = json.dumps({**s, "demandes": sorted(s["demandes"]), "textes": s["textes"][-20:]}, ensure_ascii=False)
    with connect() as conn:
        conn.execute(
            "INSERT INTO chat_sessions (session_id, etat, maj) VALUES (?, ?, ?) "
            "ON CONFLICT(session_id) DO UPDATE SET etat = excluded.etat, maj = excluded.maj",
            (session_id, etat, time.time()),
        )


def repondre(session_id: str, message: str, exclure: set[str] = frozenset(), connecte: bool = False) -> dict:
    s = _charger_session(session_id)
    controle = garde_fous.controler(message, s["nb"])
    s["nb"] += 1
    try:
        if controle["bloque"]:
            return _reponse(controle["bloque"], s["criteres"], [], [])
        reponse = _repondre(s, session_id, controle["message"], exclure, connecte)
        if controle["avertissements"]:
            reponse["reply"] = " ".join([reponse["reply"], *controle["avertissements"]])
        return reponse
    finally:
        _sauver_session(session_id, s)


def _choix_villes() -> dict:
    return {"type": "villes", "options": villes_disponibles(), "max": MAX_VILLES}


def _repondre(s: dict, session_id: str, message: str, exclure: set[str], connecte: bool) -> dict:
    t = _norm(message)
    c = s["criteres"]

    if s["attendu"] and SKIP_RE.search(t) and s["attendu"] != "villes":
        s["demandes"].add(s["attendu"])
    relache = relacher(message, c)
    nouveaux = extraire_criteres(message, s["attendu"], c.get("villes"))

    if len(nouveaux.get("villes", [])) > MAX_VILLES:
        s["attendu"] = "villes"
        return _reponse(f"Vous pouvez choisir jusqu'à {MAX_VILLES} villes. Lesquelles vous intéressent le plus ?",
                        c, ["villes"], [], choix=_choix_villes())
    c.update(nouveaux)
    if nouveaux or relache or len(t.split()) > 2:
        s["textes"].append(message)

    # Questions manquantes : villes (obligatoire), puis type et budget (une fois chacune)
    if not c.get("villes"):
        s["attendu"] = "villes"
        intro = "Bonjour ! " if s["nb"] <= 1 else ""
        return _reponse(f"{intro}Dans quelle(s) ville(s) cherchez-vous ? Vous pouvez en choisir jusqu'à {MAX_VILLES}.",
                        c, ["villes"], [], choix=_choix_villes())
    if not c.get("type_bien") and not c.get("pieces") and "type" not in s["demandes"]:
        s["attendu"] = "type"
        s["demandes"].add("type")
        return _reponse(f"C'est noté pour {', '.join(c['villes'])}. Vous cherchez plutôt un appartement ou une maison ? "
                        "Vous pouvez aussi préciser le nombre de pièces (T2, T3…).", c, ["type"], SUGGESTIONS_TYPE)
    if not c.get("budget_max") and "budget" not in s["demandes"]:
        s["attendu"] = "budget"
        s["demandes"].add("budget")
        return _reponse("Noté. Quel est votre budget maximum ?", c, ["budget"], SUGGESTIONS_BUDGET)
    s["attendu"] = None

    annonces, assouplissement = rechercher(c, " ".join(s["textes"]), exclure)
    if not annonces:
        return _reponse(
            f"Je n'ai trouvé aucune annonce pour : {resume_criteres(c)}. "
            "Essayez d'augmenter le budget ou de retirer un critère (quartier, surface, nombre de pièces).",
            c, [], SUGGESTIONS_AUCUN,
        )

    search_id = enregistrer_recherche(session_id, c, annonces, " ".join(s["textes"]))
    apercu = _apercu(annonces)
    n = apercu["count"]
    texte = (
        f"J'ai trouvé {n} annonce{'s' if n > 1 else ''} qui correspond{'ent' if n > 1 else ''} à votre recherche "
        f"({resume_criteres(c)})"
        + (f" — {assouplissement}" if assouplissement else "")
        + (". Swipez-les dès maintenant !" if connecte else
           ". Créez votre compte gratuit pour les découvrir en photos, les liker et recevoir les nouvelles annonces.")
    )
    reponse = _reponse(texte, c, [], SUGGESTIONS_RESULTATS, resultats={"search_id": search_id, **apercu}, complete=True)
    reponse["require_account"] = not connecte
    return reponse


def _reponse(reply: str, criteres: dict, missing: list[str], suggestions: list[str],
             resultats: dict | None = None, complete: bool = False, choix: dict | None = None) -> dict:
    return {
        "reply": reply,
        "slots": criteres,
        "missing": missing,
        "complete": complete,
        "suggestions": suggestions,
        "choix": choix,
        "resultats": resultats,
        "require_account": resultats is not None,
    }
