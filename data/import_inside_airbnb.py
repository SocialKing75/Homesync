# =============================================================================
# data/import_inside_airbnb.py — Catalogue de locations de vacances (France)
# =============================================================================
# Source  : Inside Airbnb — https://insideairbnb.com/get-the-data/
#           fichiers détaillés « listings.csv.gz » des villes françaises.
# Licence : Creative Commons Attribution 4.0 International (CC BY 4.0)
#           https://creativecommons.org/licenses/by/4.0/
#           Attribution obligatoire partout où les données sont affichées :
#           « Données : Inside Airbnb (insideairbnb.com), licence CC BY 4.0 ».
#
# Produit data/locations_vacances.csv : ~40 annonces par ville, variées
# (quartiers, prix, capacité), filtrées : logement entier en priorité, prix et
# photo présents, au moins 5 avis, disponibles (availability_365 > 0).
# Les prix Inside Airbnb sont affichés avec « $ » mais sont en euros pour la
# France (price_quote_raw : "currency": "EUR").
#
# Usage (les fichiers téléchargés sont des données non fiables : les lire avec
# `python -I`, depuis un dossier qui ne contient pas les téléchargements) :
#   python -I data/import_inside_airbnb.py --telecharger DOSSIER_NEUF_ET_VIDE
#   python -I data/import_inside_airbnb.py --source DOSSIER   (DOSSIER/<ville>/listings.csv.gz)
#   python -I data/import_inside_airbnb.py --derniers         (affiche les fichiers les plus récents)
# Seule la bibliothèque standard est utilisée. Sélection déterministe : mêmes
# fichiers en entrée → même CSV en sortie.
# =============================================================================

from __future__ import annotations

import argparse
import csv
import gzip
import html
import math
import re
import sys
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

PAGE = "https://insideairbnb.com/get-the-data/"
SORTIE = Path(__file__).resolve().parent / "locations_vacances.csv"
PAR_VILLE = 40
TRANCHES_PRIX = (80, 150, 250)  # €/nuit

# Fichiers utilisés pour le CSV versionné (les plus récents au 25/10/2026)
SOURCES = {
    "paris": "https://data.insideairbnb.com/france/ile-de-france/paris/2026-09-16/data/listings.csv.gz",
    "lyon": "https://data.insideairbnb.com/france/auvergne-rhone-alpes/lyon/2026-09-17/data/listings.csv.gz",
    "bordeaux": "https://data.insideairbnb.com/france/nouvelle-aquitaine/bordeaux/2026-09-17/data/listings.csv.gz",
    "pays-basque": "https://data.insideairbnb.com/france/pyr%C3%A9n%C3%A9es-atlantiques/pays-basque/2026-09-19/data/listings.csv.gz",
}
DESTINATIONS = {"paris": "Paris", "lyon": "Lyon", "bordeaux": "Bordeaux", "pays-basque": "Pays Basque"}
COMMUNE_COMME_VILLE = {"pays-basque"}  # la commune (Biarritz, Bayonne…) sert de ville

# Noms de quartiers abîmés dans les fichiers source (accents remplacés ou perdus)
QUARTIERS_CORRIGES = {
    "Entrep�t": "Entrepôt", "H�tel-de-Ville": "Hôtel-de-Ville", "M�nilmontant": "Ménilmontant",
    "Op�ra": "Opéra", "Panth�on": "Panthéon", "�lys�e": "Élysée",
    "Bgles": "Bègles", "Caudran": "Caudéran", "Artigues-Prs-Bordeaux": "Artigues-près-Bordeaux",
    "La Glacire": "La Glacière", "Le Taillan-Mdoc": "Le Taillan-Médoc", "Saint-Mdard-en-Jalles": "Saint-Médard-en-Jalles",
    "Saint-Aubin-de-Mdoc": "Saint-Aubin-de-Médoc", "Ambs": "Ambès", "Ambars-et-Lagrave": "Ambarès-et-Lagrave",
    "Beaudsert": "Beaudésert", "Nos": "Noès", "Palmer-Gravires-Cavailles": "Palmer-Gravières-Cavailles",
    "La Paillre-Compostelle": "La Paillère-Compostelle", "Centre ville (Merignac)": "Centre-ville (Mérignac)",
    "Centre ville (Bordeaux)": "Centre-ville",
}

# Locations moyenne / longue durée : pas des séjours de vacances
HORS_VACANCES = re.compile(
    r"bail mobilit|mobility lease|bail (de )?(courte|moyenne|longue)|(moyenne|longue) dur[ée]e|"
    r"long[- ]term|mid[- ]term|monthly|au mois|students? only|[ée]tudiants? uniquement", re.IGNORECASE)

COLONNES = [
    "id_source", "titre", "type", "ville", "quartier", "lat", "lon", "prix_nuit", "voyageurs", "chambres", "lits",
    "salles_de_bain", "note", "nb_avis", "min_nuits", "photos", "url_source", "description", "date_donnees",
    "destination",
]


# --- Lecture ---------------------------------------------------------------

def _nombre(valeur: str | None) -> float | None:
    texte = re.sub(r"[$€,\s]", "", valeur or "")
    try:
        return float(texte) if texte else None
    except ValueError:
        return None


def _entier(valeur: str | None) -> int | None:
    n = _nombre(valeur)
    return int(n) if n is not None else None


def texte_brut(texte: str | None, limite: int = 300) -> str:
    """HTML → texte brut d'au plus `limite` caractères (coupé sur un mot)."""
    texte = re.sub(r"<[^>]+>", " ", texte or "")
    texte = re.sub(r"\s+", " ", html.unescape(texte).replace("�", "")).strip()
    if len(texte) <= limite:
        return texte
    coupe = texte[:limite - 1].rsplit(" ", 1)[0].rstrip(" ,;:.-")
    return coupe + "…"


def reparer_encodage(texte: str) -> str:
    """« GuÃ©thary » (UTF-8 relu en Latin-1, communes du Pays Basque) → « Guéthary »."""
    if re.search("[\u00c3\u00c2][\u0080-\u00bf]", texte):
        for codec in ("latin-1", "cp1252"):
            try:
                return texte.encode(codec).decode("utf-8")
            except UnicodeError:
                continue
    return texte


def lire(path: Path) -> list[dict]:
    csv.field_size_limit(10 ** 8)
    with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


# --- Sélection ---------------------------------------------------------------

def _qualite(a: dict) -> float:
    """Note bayésienne : une note de 5/5 sur 6 avis vaut moins que 4,9/5 sur 300 avis."""
    note = a["note"] if a["note"] is not None else 4.0
    return (note * a["nb_avis"] + 4.5 * 20) / (a["nb_avis"] + 20)


def candidates(rows: list[dict], cle: str, date_defaut: str) -> list[dict]:
    """Annonces exploitables (prix, photo, ≥ 5 avis, disponibles), au format du catalogue."""
    destination = DESTINATIONS[cle]
    sortie = []
    for r in rows:
        prix, lat, lon = _nombre(r.get("price")), _nombre(r.get("latitude")), _nombre(r.get("longitude"))
        if not prix or prix <= 0 or lat is None or lon is None or not (r.get("name") or "").strip():
            continue
        if not (r.get("picture_url") or "").startswith("https://"):
            continue
        if HORS_VACANCES.search(f"{r.get('name')} {r.get('description')}"):
            continue
        if (_entier(r.get("number_of_reviews")) or 0) < 5 or (_entier(r.get("availability_365")) or 0) <= 0:
            continue
        quartier = reparer_encodage((r.get("neighbourhood_cleansed") or "").strip())
        quartier = QUARTIERS_CORRIGES.get(quartier, quartier)
        sortie.append({
            "id_source": f"airbnb-{r['id']}",
            "titre": texte_brut(r.get("name"), 120),
            "type": (r.get("property_type") or "").strip(),
            "ville": (quartier or destination) if cle in COMMUNE_COMME_VILLE else destination,
            "quartier": quartier,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "prix_nuit": round(prix, 2),
            "voyageurs": _entier(r.get("accommodates")),
            "chambres": _entier(r.get("bedrooms")),
            "lits": _entier(r.get("beds")),
            "salles_de_bain": (r.get("bathrooms_text") or "").strip(),
            "note": _nombre(r.get("review_scores_rating")),
            "nb_avis": _entier(r.get("number_of_reviews")) or 0,
            "min_nuits": _entier(r.get("minimum_nights")),
            "photos": r["picture_url"].strip(),
            "url_source": f"https://www.airbnb.com/rooms/{r['id']}",
            "description": texte_brut(r.get("description")),
            "date_donnees": (r.get("last_scraped") or date_defaut).strip(),
            "destination": destination,
            "_entier": r.get("room_type") == "Entire home/apt",
        })
    return sortie


def _niveaux(annonces: list[dict]) -> None:
    """Tranche de prix et taille (1-2, 3-4, 5+ voyageurs) : critères de variété. Tranches
    fixes, alignées sur les budgets proposés par le chat (80, 150, 250 €) : chaque
    suggestion trouve des annonces, même à Paris où le 1er quartile dépasse 170 €."""
    for a in annonces:
        a["_prix"] = sum(a["prix_nuit"] >= b for b in TRANCHES_PRIX)
        v = a["voyageurs"] or 1
        a["_taille"] = 0 if v <= 2 else 1 if v <= 4 else 2


def _quotas(par_quartier: dict[str, list[dict]], n: int) -> dict[str, int]:
    """Répartition de n annonces entre les quartiers : tous s'il y en a au plus n/2
    (arrondissements de Paris, de Lyon), sinon les mieux fournis (75 % de l'offre, n/2 au
    plus) ; proportionnelle à effectif^0,7 (plus étale que l'offre brute)."""
    ordre = sorted(par_quartier, key=lambda q: (-len(par_quartier[q]), q))
    total, cumul, retenus = sum(len(v) for v in par_quartier.values()), 0, []
    for q in ordre:
        if len(ordre) > n // 2 and (len(retenus) >= max(1, n // 2) or (retenus and cumul >= 0.75 * total)):
            break
        retenus.append(q)
        cumul += len(par_quartier[q])
    poids = {q: len(par_quartier[q]) ** 0.7 for q in retenus}
    somme = sum(poids.values())
    exacts = {q: n * p / somme for q, p in poids.items()}
    quotas = {q: max(1, min(len(par_quartier[q]), math.floor(x))) for q, x in exacts.items()}
    for q in sorted(retenus, key=lambda q: -(exacts[q] - math.floor(exacts[q]))):  # plus forts restes
        if sum(quotas.values()) >= n:
            break
        if quotas[q] < len(par_quartier[q]):
            quotas[q] += 1
    return quotas


def selectionner(annonces: list[dict], n: int = PAR_VILLE) -> list[dict]:
    """n annonces variées : quartiers (quotas), puis à chaque tour, dans le quartier, la
    mieux notée de la combinaison tranche de prix × taille la moins représentée."""
    for filtre in (
        lambda a: a["_entier"] and (a["min_nuits"] or 99) <= 7 and a["prix_nuit"] <= 1500 and a["note"] is not None,
        lambda a: a["_entier"],
        lambda a: True,  # logement entier en priorité ; chambres seulement s'il en manque
    ):
        pool = [a for a in annonces if filtre(a)]
        if len(pool) >= n:
            break
    _niveaux(pool)
    par_quartier: dict[str, list[dict]] = {}
    for a in sorted(pool, key=lambda a: (-_qualite(a), a["id_source"])):
        par_quartier.setdefault(a["quartier"] or "?", []).append(a)
    quotas = _quotas(par_quartier, n)

    choisies: list[dict] = []
    vus_prix, vus_taille = Counter(), Counter()
    while len(choisies) < n and any(quotas.values()):
        for q in sorted(quotas, key=lambda q: (-quotas[q], q)):
            if not quotas[q] or len(choisies) >= n:
                continue
            tetes: dict[tuple[int, int], dict] = {}  # meilleure annonce restante de chaque combinaison
            for a in par_quartier[q]:
                if a not in choisies:
                    tetes.setdefault((a["_prix"], a["_taille"]), a)
            a = min(tetes.values(), key=lambda a: (vus_prix[a["_prix"]] + 0.5 * vus_taille[a["_taille"]], -_qualite(a)))
            choisies.append(a)
            vus_prix[a["_prix"]] += 1
            vus_taille[a["_taille"]] += 1
            quotas[q] -= 1
    return choisies


# --- Téléchargement / découverte -------------------------------------------

def derniers_fichiers() -> dict[str, str]:
    """Fichiers listings.csv.gz les plus récents des villes françaises de la page Inside Airbnb."""
    req = urllib.request.Request(PAGE, headers={"User-Agent": "Mozilla/5.0"})
    page = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
    urls: dict[str, str] = {}
    for url in sorted(set(re.findall(r"https://data\.insideairbnb\.com/france/[^\"']+?/listings\.csv\.gz", page))):
        cle = url.split("/")[5]
        if cle not in urls or url.split("/")[6] > urls[cle].split("/")[6]:
            urls[cle] = url
    return urls


def telecharger(dossier: Path, sources: dict[str, str]) -> None:
    for cle, url in sources.items():
        cible = dossier / cle
        cible.mkdir(parents=True, exist_ok=False)  # dossier neuf par fichier
        req = urllib.request.Request(urllib.parse.quote(url, safe=":/%"), headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=900) as r, open(cible / "listings.csv.gz", "wb") as f:
            f.write(r.read())
        print(f"téléchargé : {cle}")


# --- Programme ---------------------------------------------------------------

def construire(dossier: Path, sortie: Path = SORTIE, sources: dict[str, str] = SOURCES) -> list[dict]:
    lignes = []
    for cle, url in sources.items():
        if cle not in DESTINATIONS:
            print(f"ville ignorée (ajoutez-la à DESTINATIONS) : {cle}", file=sys.stderr)
            continue
        rows = lire(dossier / cle / "listings.csv.gz")
        date_fichier = url.split("/")[6]
        choisies = selectionner(candidates(rows, cle, date_fichier))
        prix = [a["prix_nuit"] for a in choisies]
        print(f"{DESTINATIONS[cle]:<12} {len(rows):>6} annonces source -> {len(choisies)} retenues "
              f"({min(prix):.0f}-{max(prix):.0f} €/nuit, {len({a['quartier'] for a in choisies})} quartiers, "
              f"fichier du {date_fichier})")
        lignes += choisies
    with sortie.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLONNES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows({k: ("" if a.get(k) is None else a[k]) for k in COLONNES} for a in lignes)
    print(f"{len(lignes)} annonces écrites dans {sortie}")
    return lignes


def main() -> None:
    sys.stdout.reconfigure(errors="replace")  # console Windows (cp1252) : pas d'erreur d'affichage
    parser = argparse.ArgumentParser(description="Catalogue de locations de vacances depuis Inside Airbnb (CC BY 4.0).")
    groupe = parser.add_mutually_exclusive_group(required=True)
    groupe.add_argument("--source", type=Path, help="dossier contenant <ville>/listings.csv.gz")
    groupe.add_argument("--telecharger", type=Path, help="dossier neuf où télécharger les fichiers, puis importer")
    groupe.add_argument("--derniers", action="store_true", help="affiche les fichiers les plus récents et quitte")
    parser.add_argument("--sortie", type=Path, default=SORTIE)
    args = parser.parse_args()

    if args.derniers:
        for cle, url in derniers_fichiers().items():
            print(cle, url)
        return
    if args.telecharger:
        telecharger(args.telecharger, SOURCES)
    construire(args.telecharger or args.source, args.sortie)


if __name__ == "__main__":
    main()
