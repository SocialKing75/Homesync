# =============================================================================
# backend/vacances/catalogue.py — Catalogue de locations de vacances (France)
# =============================================================================
# Source : data/locations_vacances.csv, produit par data/import_inside_airbnb.py
# depuis Inside Airbnb — licence CC BY 4.0 : l'attribution (attribution()) doit
# accompagner toute annonce affichée.
# Recherche : lieux (destination « Pays Basque » ou commune « Biarritz », sans
# accents ni casse), voyageurs ≥ n, budget max par nuit ; tri par pertinence
# (score, puis note, nombre d'avis, prix). La disponibilité aux dates n'est pas
# connue : elle se vérifie sur l'annonce.
# Score de matching /100, même format que le mode achat ({score, detail}) :
#   budget     25  prix/nuit ≤ budget ; dégressif jusqu'à +10 %, 0 au-delà
#   voyageurs  15  capacité suffisante pour le groupe
#   note       25  note des voyageurs : 4,0/5 → 0 pt, 5/5 → 25 pts
#   avis       15  nombre d'avis (fiabilité de la note), plein à 200 avis
#   prix       10  prix/nuit vs médiane des locations comparables de la destination
#   sejour     10  durée minimum de location compatible avec le séjour
# Un critère non renseigné donne tous ses points (comme en mode achat).
# =============================================================================

from __future__ import annotations

import csv
import math
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path
from statistics import median
from typing import Iterable

from backend.chat.garde_fous import _norm

ROOT = Path(__file__).resolve().parents[2]
CSV_VACANCES = ROOT / "data" / "locations_vacances.csv"
PREFIXE_ID = "airbnb-"
MAX_RESULTS = 30

SOURCE = {
    "nom": "Inside Airbnb",
    "url": "https://insideairbnb.com/",
    "licence": "CC BY 4.0",
    "licence_url": "https://creativecommons.org/licenses/by/4.0/",
}

POIDS = {"budget": 25, "voyageurs": 15, "note": 25, "avis": 15, "prix": 10, "sejour": 10}
LIBELLES_CRITERES = {
    "fr": {"budget": "budget", "voyageurs": "voyageurs", "note": "note", "avis": "avis", "prix": "prix", "sejour": "séjour"},
    "en": {"budget": "budget", "voyageurs": "travellers", "note": "rating", "avis": "reviews", "prix": "price", "sejour": "stay"},
}
LIBELLES_LIEUX_EN = {"Pays Basque": "Basque Country"}

# Autres noms d'une destination du catalogue
ALIAS = {
    "Basque Country": "Pays Basque", "French Basque Country": "Pays Basque", "Basque coast": "Pays Basque",
    "Côte basque": "Pays Basque", "Pays basque français": "Pays Basque", "Lyons": "Lyon",
}
# Destinations demandées mais absentes du catalogue : réponse « pas encore disponible »
DESTINATIONS_ABSENTES = [
    "Nice", "Marseille", "Cannes", "Antibes", "Menton", "Saint-Tropez", "Montpellier", "Toulouse", "Strasbourg",
    "Lille", "Nantes", "Rennes", "Annecy", "Chamonix", "La Rochelle", "Avignon", "Toulon", "Ajaccio", "Bastia",
    "Arcachon", "Deauville", "Saint-Malo", "Grenoble", "Dijon", "Reims", "Tours", "Aix-en-Provence", "Nîmes",
    "Arles", "Perpignan", "Carcassonne", "Colmar", "Metz", "Nancy", "Caen", "Rouen", "Le Havre", "Lourdes", "Pau",
    "Megève", "Courchevel", "Corse", "Provence", "Normandie", "Bretagne", "Côte d'Azur", "Alsace", "Dordogne",
    "Brest", "Angers", "Monaco",
]
ALIAS_ABSENTES = {"Marseilles": "Marseille", "Corsica": "Corse", "Brittany": "Bretagne", "Normandy": "Normandie",
                  "French Riviera": "Côte d'Azur", "Riviera": "Côte d'Azur"}
AMBIGUS = {"nice", "tours", "orange", "lens", "sens", "cannes"}  # aussi des mots courants : majuscule exigée


# --- Chargement ---------------------------------------------------------------

def _float(v) -> float | None:
    try:
        return float(v) if v not in ("", None) else None
    except (TypeError, ValueError):
        return None


def _int(v) -> int | None:
    f = _float(v)
    return int(f) if f is not None else None


@lru_cache(maxsize=None)
def _motif(nom: str) -> re.Pattern:
    """« Saint-Jean-de-Luz » ↔ « st jean de luz », « saint jean-de-luz »…"""
    mots = [m for m in re.split(r"[\s'’-]+", _norm(nom)) if m]
    parties = [r"(?:saint|st)\.?" if m == "saint" else r"(?:sainte|ste)\.?" if m == "sainte" else re.escape(m)
               for m in mots]
    return re.compile(r"\b" + r"[\s'’.-]*".join(parties) + r"\b")


def _typer(r: dict) -> dict:
    """Ligne du CSV → annonce au format de l'API (prix = prix par nuit)."""
    return {
        "id_source": r["id_source"],
        "titre": r.get("titre") or r.get("type") or "Location",
        "type": r.get("type") or None,
        "prix": _float(r.get("prix_nuit")),
        "unite_prix": "nuit",
        "ville": r.get("ville") or r.get("destination") or None,
        "quartier": r.get("quartier") or None,
        "lat": _float(r.get("lat")),
        "lon": _float(r.get("lon")),
        "photos": [p for p in (r.get("photos") or "").split("|") if p],
        "url_source": r.get("url_source") or None,
        "voyageurs": _int(r.get("voyageurs")),
        "chambres": _int(r.get("chambres")),
        "lits": _int(r.get("lits")),
        "salles_de_bain": r.get("salles_de_bain") or None,
        "note": _float(r.get("note")),
        "nb_avis": _int(r.get("nb_avis")) or 0,
        "min_nuits": _int(r.get("min_nuits")),
        "description": r.get("description") or "",
        "source": SOURCE["nom"],
        "destination": r.get("destination") or r.get("ville") or None,
        "date_donnees": r.get("date_donnees") or None,
    }


@lru_cache(maxsize=2)
def _charger(chemin: str, _version: int) -> dict:
    path = Path(chemin)
    annonces = []
    if path.exists():
        with path.open(encoding="utf-8", newline="") as f:
            annonces = [_typer(r) for r in csv.DictReader(f) if r.get("id_source")]
    comptes = Counter(a["destination"] for a in annonces)
    ordre = list(dict.fromkeys(a["destination"] for a in annonces))
    destinations = sorted(comptes, key=lambda d: (-comptes[d], ordre.index(d)))
    villes = Counter(a["ville"] for a in annonces)
    zone = {}
    for a in annonces:
        zone.setdefault(a["ville"], a["destination"])
        zone[a["destination"]] = a["destination"]
    noms = {lieu: lieu for lieu in [*destinations, *villes]}
    noms.update({alias: canon for alias, canon in ALIAS.items() if canon in zone})
    dates = sorted(a["date_donnees"] for a in annonces if a["date_donnees"])
    return {
        "annonces": annonces,
        "par_id": {a["id_source"]: a for a in annonces},
        "destinations": destinations,
        "villes": villes,
        "zone": zone,  # lieu → destination
        "motifs": [(_motif(nom), canon) for nom, canon in noms.items()],
        "periode": (dates[0], dates[-1]) if dates else (None, None),
        "medianes": {},
    }


def _cat() -> dict:
    return _charger(str(CSV_VACANCES), CSV_VACANCES.stat().st_mtime_ns if CSV_VACANCES.exists() else 0)


def annonces() -> list[dict]:
    return _cat()["annonces"]


def par_id() -> dict[str, dict]:
    return _cat()["par_id"]


def destinations() -> list[str]:
    """Destinations du catalogue (« Paris », « Pays Basque »…), de la mieux à la moins fournie."""
    return _cat()["destinations"]


def destination_de(lieu: str) -> str | None:
    return _cat()["zone"].get(lieu)


def options_lieux(min_annonces: int = 3) -> list[str]:
    """Choix proposés : les destinations, puis les communes les mieux fournies (Biarritz, Bayonne…)."""
    cat = _cat()
    communes = [v for v, n in cat["villes"].most_common() if n >= min_annonces and v not in cat["destinations"]]
    return cat["destinations"] + communes


def libelle_lieu(lieu: str, lang: str = "fr") -> str:
    return LIBELLES_LIEUX_EN.get(lieu, lieu) if lang == "en" else lieu


def _de(lieu: str) -> str:
    """« de Paris », « du Pays Basque », « d'Anglet »."""
    if lieu.startswith("Pays "):
        return "du " + lieu
    return ("d'" if _norm(lieu[:1]) in "aeiouyh" else "de ") + lieu


def periode_donnees() -> tuple[str | None, str | None]:
    return _cat()["periode"]


def attribution(lang: str = "fr") -> str:
    """Texte à afficher avec les annonces (licence CC BY 4.0)."""
    debut, fin = periode_donnees()
    mois_fr = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre",
               "novembre", "décembre"]
    mois_en = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
               "November", "December"]
    if lang == "en":
        quand = f" — data collected in {mois_en[int(fin[5:7]) - 1]} {fin[:4]}" if fin else ""
        return f"Rental data: Inside Airbnb (insideairbnb.com), licensed under CC BY 4.0{quand}."
    quand = f" — données collectées en {mois_fr[int(fin[5:7]) - 1]} {fin[:4]}" if fin else ""
    return f"Données de locations : Inside Airbnb (insideairbnb.com), licence CC BY 4.0{quand}."


def infos(lang: str = "fr") -> dict:
    cat = _cat()
    debut, fin = cat["periode"]
    return {
        "destinations": [{"nom": d, "libelle": libelle_lieu(d, lang),
                          "nb_annonces": sum(1 for a in cat["annonces"] if a["destination"] == d),
                          "villes": sorted({a["ville"] for a in cat["annonces"] if a["destination"] == d and a["ville"] != d})}
                         for d in cat["destinations"]],
        "nb_annonces": len(cat["annonces"]),
        "unite_prix": "nuit",
        "source": SOURCE,
        "attribution": attribution(lang),
        "periode_donnees": {"debut": debut, "fin": fin},
    }


# --- Lieux cités dans un message -----------------------------------------------

def extraire_lieux(texte: str, autres_villes: Iterable[str] = ()) -> tuple[list[str], list[str]]:
    """(lieux du catalogue cités, dans l'ordre du message ; lieux cités absents du catalogue).
    `autres_villes` : villes connues ailleurs (mode achat), pour répondre « pas encore disponible »."""
    t = _norm(texte).replace("’", "'")
    trouves = sorted((m.start(), canon) for motif, canon in _cat()["motifs"] for m in [motif.search(t)] if m)
    connus = list(dict.fromkeys(canon for _, canon in trouves))
    if connus:
        return connus, []
    inconnus = []
    for nom in [*DESTINATIONS_ABSENTES, *ALIAS_ABSENTES, *autres_villes]:
        canon = ALIAS_ABSENTES.get(nom, nom)
        if not _motif(nom).search(t):
            continue
        n = _norm(nom)
        seul = re.fullmatch(rf"\s*(?:(?:in|to|at|a|en|vers|sur)\s+)?{_motif(nom).pattern}\s*[.!?]*\s*", t)
        if n in AMBIGUS and not (re.search(rf"\b{re.escape(nom)}\b", texte) or seul):
            continue
        inconnus.append(canon)
    return [], list(dict.fromkeys(inconnus))


# --- Recherche -------------------------------------------------------------------

def _respecte(a: dict, c: dict, *, region: bool = False, marge: float = 1.0) -> bool:
    lieux = c.get("villes") or []
    if lieux:
        if region:
            if a["destination"] not in {destination_de(l) for l in lieux}:
                return False
        elif a["ville"] not in lieux and a["destination"] not in lieux:
            return False
    if c.get("voyageurs") and (a["voyageurs"] or 0) < c["voyageurs"]:
        return False
    if c.get("budget_max") and (a["prix"] or 0) > c["budget_max"] * marge:
        return False
    return True


def filtrer(c: dict, exclure: Iterable[str] = frozenset(), **options) -> list[dict]:
    """Annonces respectant les critères : villes / destinations, voyageurs ≥ n, budget max par nuit."""
    exclure = set(exclure)
    return [a for a in annonces() if a["id_source"] not in exclure and _respecte(a, c, **options)]


def rechercher(c: dict, exclure: Iterable[str] = frozenset(), lang: str = "fr") -> tuple[list[dict], str | None]:
    """Annonces triées par pertinence, et l'assouplissement appliqué si la recherche stricte
    ne donne rien : "region" (commune → toute la destination), "budget" (+10 %)."""
    etapes = [({}, None)]
    if any(lieu not in destinations() for lieu in c.get("villes") or []):
        etapes.append(({"region": True}, "region"))
    if c.get("budget_max"):
        etapes.append(({"region": True, "marge": 1.10}, "budget"))
    for options, assouplissement in etapes:
        trouvees = filtrer(c, exclure, **options)
        if trouvees:
            return matcher(c, trouvees, lang)[:MAX_RESULTS], assouplissement
    return [], None


def resultats(criteres: dict, ids: list[str], exclure: Iterable[str] = frozenset(), lang: str | None = None) -> list[dict]:
    """Annonces complètes d'une recherche enregistrée, avec leur score, classées."""
    exclure, index = set(exclure), par_id()
    return matcher(criteres, [index[i] for i in ids if i in index and i not in exclure],
                   lang or criteres.get("lang") or "fr")


def resume_favori(annonce_id: str) -> dict | None:
    """Annonce telle que renvoyée dans la liste des favoris (/api/likes)."""
    a = par_id().get(annonce_id)
    if a is None:
        return None
    return {**a, "photos": list(a["photos"]), "type_bien": a["type"], "url": a["url_source"], "surface": None}


# --- Score de matching ------------------------------------------------------------

def _eur(n: float, lang: str) -> str:
    return f"€{n:,.0f}" if lang == "en" else f"{n:,.0f} €".replace(",", " ")


def _pl(n: int, mot: str) -> str:
    """« 1 voyageur », « 3 voyageurs », « 1 night », « 2 nights »."""
    return f"{n} {mot}{'' if n == 1 else 's'}"


def _critere(nom: str, points: float, explication: str, lang: str) -> dict:
    return {"critere": LIBELLES_CRITERES[lang][nom], "points": round(points, 1), "max": POIDS[nom], "explication": explication}


def _mediane(destination: str, groupe: int) -> float | None:
    cache = _cat()["medianes"]
    if (destination, groupe) not in cache:
        prix = [a["prix"] for a in annonces() if a["destination"] == destination and (a["voyageurs"] or 0) >= groupe and a["prix"]]
        cache[(destination, groupe)] = median(prix) if len(prix) >= 5 else None
    return cache[(destination, groupe)]


def scorer(a: dict, c: dict, lang: str = "fr") -> dict:
    en = lang == "en"
    detail = []
    prix = a["prix"] or 0

    budget = c.get("budget_max")
    if not budget:
        detail.append(_critere("budget", 25, "No budget given" if en else "Pas de budget indiqué", lang))
    elif prix <= budget:
        detail.append(_critere("budget", 25, f"{_eur(prix, lang)}/night, within budget ({_eur(budget, lang)})" if en
                               else f"{_eur(prix, lang)}/nuit, dans le budget ({_eur(budget, lang)})", lang))
    elif prix <= budget * 1.1:
        depasse = (prix - budget) / budget
        detail.append(_critere("budget", 25 * (1 - depasse / 0.1), f"{depasse:.0%} over budget" if en
                               else f"Dépasse le budget de {depasse:.0%}", lang))
    else:
        detail.append(_critere("budget", 0, f"Over budget ({_eur(prix, lang)}/night)" if en
                               else f"Hors budget ({_eur(prix, lang)}/nuit)", lang))

    groupe, capacite = c.get("voyageurs"), a["voyageurs"] or 0
    mot = "traveller" if en else "voyageur"
    if not groupe:
        detail.append(_critere("voyageurs", 15, f"Up to {_pl(capacite, mot)}" if en
                               else f"Jusqu'à {_pl(capacite, mot)}", lang))
    elif capacite >= groupe:
        detail.append(_critere("voyageurs", 15, f"Up to {_pl(capacite, mot)} (you are {groupe})" if en
                               else f"Jusqu'à {_pl(capacite, mot)} (vous êtes {groupe})", lang))
    else:
        detail.append(_critere("voyageurs", 0, f"Too small: {_pl(capacite, mot)} max" if en
                               else f"Trop petit : {_pl(capacite, mot)} maximum", lang))

    note = a["note"]
    if note is None:
        detail.append(_critere("note", 10, "No rating yet" if en else "Pas encore de note", lang))
    else:
        texte = f"{note:.2f}".rstrip("0").rstrip(".")
        detail.append(_critere("note", 25 * min(1.0, max(0.0, note - 4.0)),
                               f"Guest rating: {texte}/5" if en else f"Note des voyageurs : {texte.replace('.', ',')}/5", lang))

    nb = a["nb_avis"]
    detail.append(_critere("avis", 15 * min(1.0, math.log1p(nb) / math.log1p(200)),
                           _pl(nb, "review") if en else f"{nb} avis", lang))

    med = _mediane(a["destination"], groupe or 1)
    lieu = libelle_lieu(a["destination"], lang)
    if not med or not prix:
        detail.append(_critere("prix", 5, "Not enough price references" if en else "Pas assez de références de prix", lang))
    else:
        ratio = prix / med
        pts = 10 if ratio <= 0.8 else 0 if ratio >= 1.2 else 10 * (1.2 - ratio) / 0.4
        pour = (f" for {_pl(groupe, mot)}" if en else f" pour {_pl(groupe, mot)}") if groupe else ""
        if abs(ratio - 1) < 0.005:
            texte = f"At the median price in {lieu}{pour}" if en else f"Au prix médian {_de(lieu)}{pour}"
        elif en:
            texte = f"{abs(ratio - 1):.0%} {'below' if ratio < 1 else 'above'} the median price in {lieu}{pour}"
        else:
            texte = f"{abs(ratio - 1):.0%} {'sous' if ratio < 1 else 'au-dessus de'} la médiane {_de(lieu)}{pour}"
        detail.append(_critere("prix", pts, texte, lang))

    mini, nuits = a["min_nuits"] or 1, c.get("nuits")
    nuit = "night" if en else "nuit"
    if nuits and nuits >= mini:
        detail.append(_critere("sejour", 10, f"Minimum {_pl(mini, nuit)} ✓ ({nuits}-night stay)" if en
                               else f"Minimum {_pl(mini, nuit)} ✓ (séjour de {_pl(nuits, nuit)})", lang))
    elif nuits:
        detail.append(_critere("sejour", 0, f"Minimum {_pl(mini, nuit)}: longer than your {nuits}-night stay" if en
                               else f"Minimum {_pl(mini, nuit)} : plus long que votre séjour ({_pl(nuits, nuit)})", lang))
    else:
        pts = 10 if mini <= 2 else 7 if mini <= 4 else 4 if mini <= 7 else 0
        detail.append(_critere("sejour", pts, f"Minimum stay: {_pl(mini, nuit)}" if en
                               else f"Séjour minimum : {_pl(mini, nuit)}", lang))

    return {"score": round(sum(d["points"] for d in detail)), "detail": detail}


def matcher(c: dict, choisies: list[dict], lang: str = "fr") -> list[dict]:
    """Annonces (copies) enrichies de `match`, triées par pertinence : score, note, nombre d'avis, prix."""
    notees = [{**a, "photos": list(a["photos"]), "match": scorer(a, c, lang)} for a in choisies]
    return sorted(notees, key=lambda a: (-a["match"]["score"], -(a["note"] or 0), -a["nb_avis"], a["prix"] or 0))
