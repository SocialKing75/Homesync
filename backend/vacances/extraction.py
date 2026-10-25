# =============================================================================
# backend/vacances/extraction.py — Critères d'un séjour dans un message (EN / FR)
# =============================================================================
# voyageurs : « 2 people », « 2 personnes », « a couple », « 2 adultes et 1 enfant »
# budget    : « 150€ per night », « 150 € la nuit », « under 200 », « €80 »
#             (« 900 € au total » + durée connue → prix par nuit)
# dates     : « 12-15 July », « du 12 au 15 juillet », « 12/07 - 15/07 »,
#             « 2026-07-12 », « this weekend », « ce week-end » ; durée : « 3 nights »
# Texte normalisé avant extraction : minuscules, sans accents.
# =============================================================================

from __future__ import annotations

import re
from datetime import date, timedelta

from backend.chat.garde_fous import _norm

NOMBRES = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
           "ten": 10, "un": 1, "une": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "sept": 7, "huit": 8,
           "neuf": 9, "dix": 10}
N = r"(\d{1,2}|" + "|".join(NOMBRES) + r")"
N_PLURIEL = r"(\d{1,2}|" + "|".join(k for k, v in NOMBRES.items() if v > 1) + r")"
MAX_VOYAGEURS = 16

PERSONNES = r"(?:people|persons?|pers\b\.?|personnes?|guests?|travell?ers?|voyageurs?|ppl|pax|occupants?|of us)"
ADULTES = r"(?:adults?|adultes?|grown[- ]?ups?)"
ENFANTS = r"(?:kids?|children|child|enfants?|bebes?|babies|baby|teens?|teenagers?|ados?|adolescents?|toddlers?)"
PAS_DES_GENS = (r"(?!\s*(?:nights?|nuits?|days?|jours?|weeks?|week|semaines?|mois|months?|€|e\b|eur|euros?|k\b|%|ans?\b|"
                r"years?|h\b|chambres?|bedrooms?|rooms?|pieces?|lits?|beds?|pas\b|steps?|min|km|m\b|[/.,:]\d|\d))")
COUPLE = re.compile(r"\b(?:a couple|couple|en amoureux|the two of us|nous deux|my partner and i|"
                    r"with my (?:wife|husband|partner|girlfriend|boyfriend)|"
                    r"avec (?:ma|mon) (?:femme|mari|copine|copain|compagne|compagnon|conjointe?)|"
                    r"(?:for two|pour deux|a deux)" + PAS_DES_GENS + r")\b")
SOLO = re.compile(r"\b(?:solo|alone|just me|only me|by myself|myself|seule?|tout seul|toute seule|juste moi|moi seule?)\b")

DEVISE = r"(?:€|eur\b|euros?\b|e\b)"
MONTANT = r"(\d{1,5}(?:[.,]\d{1,2})?)"
PAS_UN_PRIX = (r"(?!\s*(?:people|personnes?|pers|voyageurs?|guests?|travell?ers?|adults?|adultes?|kids?|enfants?|"
               r"nights?|nuits?|days?|jours?|weeks?|semaines?|%|m2|m²|m\b|km|min|chambres?|bedrooms?|lits?|beds?|"
               r"ans?\b|years?|[/.]\d))")
BUDGET_DEVISE = re.compile(rf"€\s*{MONTANT}|\b{MONTANT}\s*{DEVISE}")
BUDGET_MOT = re.compile(rf"\b(?:budget|max(?:imum)?|maxi|under|below|less than|up to|no more than|moins de|"
                        rf"jusqu'?a|pas plus de|au plus|en dessous de)\s*(?:(?:of|de|to|a|:|=|around|about|environ|"
                        rf"d'environ|is|est|per night|par nuit)\s*)*{MONTANT}\b{PAS_UN_PRIX}")
BUDGET_UNITE = re.compile(rf"\b{MONTANT}\s*(?:per night|a night|/\s*night|by night|nightly|par nuit|la nuit|/\s*nuit)")
TOTAL = re.compile(r"\b(?:in total|total|au total|en tout|for the (?:whole )?(?:stay|trip)|pour (?:tout )?le sejour|"
                   r"for the week|pour la semaine)\b")

SANS_LIMITE = re.compile(r"\b(?:no limits?|unlimited|no budget|any budget|any price|no max(?:imum)?|sans limite|"
                         r"pas de limite|illimite|pas de budget|budget illimite|peu importe le (?:budget|prix))\b")
PASSER = re.compile(r"\b(?:peu importe|n'importe|indifferent|doesn'?t matter|does not matter|whatever|"
                    r"(?:i )?don'?t mind|no preference|pas de preference|skip|passer|je passe|any|no idea|"
                    r"aucune idee|je ne sais pas|i don'?t know|not sure|pas sur)\b")
DATES_FLEXIBLES = re.compile(r"\b(?:flexibles?|no dates?|pas de dates?|sans dates?|not sure|pas sur|pas encore|"
                             r"not yet|undecided|any ?time|whenever|n'importe quand|later|plus tard|skip|passer|"
                             r"peu importe|je ne sais pas|i don'?t know)\b")
# Comprises même quand la question des dates n'a pas été posée
DATES_FLEXIBLES_EXPLICITE = re.compile(r"\b(?:flexible dates?|dates? (?:are |sont )?flexibles?|i'?m flexible|"
                                       r"je suis flexible|no dates?|pas de dates?|sans dates?|any ?time|"
                                       r"n'importe quand)\b")

MOIS = {"january": 1, "janvier": 1, "janv": 1, "jan": 1, "february": 2, "fevrier": 2, "fevr": 2, "fev": 2,
        "feb": 2, "march": 3, "mars": 3, "mar": 3, "april": 4, "avril": 4, "avr": 4, "apr": 4, "may": 5, "mai": 5,
        "june": 6, "juin": 6, "jun": 6, "july": 7, "juillet": 7, "juil": 7, "jul": 7, "august": 8, "aout": 8,
        "aug": 8, "september": 9, "septembre": 9, "sept": 9, "sep": 9, "october": 10, "octobre": 10, "oct": 10,
        "november": 11, "novembre": 11, "nov": 11, "december": 12, "decembre": 12, "dec": 12}
_MOIS = "(" + "|".join(sorted(MOIS, key=len, reverse=True)) + r")\.?"
_J = r"(\d{1,2})(?:st|nd|rd|th|er|eme|e)?"
_SEP = r"\s*(?:-|to|au|a|until|till|through|thru|jusqu'au|jusqu'a)\s*"
_AN = r"(?:,?\s+(\d{4}))?"
PLAGE_J_MOIS = re.compile(rf"\b{_J}{_SEP}{_J}\s+(?:of\s+)?{_MOIS}{_AN}")         # 12-15 july, du 12 au 15 juillet
PLAGE_MOIS_J = re.compile(rf"\b{_MOIS}\s+{_J}{_SEP}{_J}\b{_AN}")                  # july 12-15
PLAGE_NUM = re.compile(rf"(?<![/.])\b(\d{{1,2}}){_SEP}(\d{{1,2}})[/.](\d{{1,2}})(?:[/.](\d{{2,4}}))?\b")  # 12-15/07
DATE_ISO = re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")
DATE_NUM = re.compile(r"\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b")
DATE_J_MOIS = re.compile(rf"\b{_J}\s+(?:of\s+)?{_MOIS}(?![a-z]){_AN}")
DATE_MOIS_J = re.compile(rf"\b{_MOIS}\s+{_J}\b{_AN}")
CE_WEEKEND = re.compile(r"\b(?:this|ce)\s+week-?end\b")
WEEKEND_PROCHAIN = re.compile(r"\bnext\s+week-?end\b|\bweek-?end\s+prochain\b")
UN_WEEKEND = re.compile(r"\b(?:a|one|un|for the|pour le)\s+week-?end\b")
DUREE_NUITS = re.compile(rf"\b{N}\s*(?:nights?|nuits?)\b")
DUREE_SEMAINES = re.compile(rf"\b(?:(?:a|one|une|un)\s+(?:week|semaine)|{N}\s*(?:weeks?|semaines?))\b")
MAX_NUITS = 90


def normaliser(texte: str) -> str:
    t = _norm(texte).replace("’", "'").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", t).strip()


def _n(mot: str) -> int:
    return int(mot) if mot.isdigit() else NOMBRES[mot]


def _voyageurs_valide(n: int) -> int | None:
    return n if 1 <= n <= MAX_VOYAGEURS else None


def extraire_voyageurs(t: str, attendu: bool = False) -> int | None:
    """Nombre de voyageurs d'un texte normalisé ; `attendu` : un nombre seul y répond."""
    enfants = re.search(rf"\b{N}\s*(?:little\s+|young\s+|petits?\s+|jeunes\s+)?{ENFANTS}\b", t)
    n_enfants = _n(enfants.group(1)) if enfants else 0
    adultes = re.search(rf"\b{N}\s*{ADULTES}\b", t)
    if adultes:
        return _voyageurs_valide(_n(adultes.group(1)) + n_enfants)
    for motif in (rf"\b{N}\s*{PERSONNES}", rf"\b(?:family of|famille de|group of|groupe de)\s*{N}\b",
                  rf"\b(?:we are|we're|we will be|we'll be|there are|there will be|nous sommes|nous serons|"
                  rf"on est|on sera)\s*{N}\b"):
        m = re.search(motif, t)
        if m:
            return _voyageurs_valide(_n(m.group(1)))
    if COUPLE.search(t):
        return _voyageurs_valide(2 + n_enfants)
    if SOLO.search(t):
        return _voyageurs_valide(1 + n_enfants)
    m = re.search(rf"\b(?:for|pour)\s+{N_PLURIEL}\b{PAS_DES_GENS}", t)
    if m:
        return _voyageurs_valide(_n(m.group(1)))
    if attendu:
        m = re.fullmatch(rf"{N}\s*\+?\s*(?:{PERSONNES})?", t)
        if m:
            return _voyageurs_valide(_n(m.group(1)))
    return None


def _prix(texte: str) -> float:
    return float(texte.replace(",", "."))


def extraire_budget(t: str, attendu: bool = False, nuits: int | None = None) -> float | None:
    """Budget maximum par nuit (€) d'un texte normalisé."""
    t = re.sub(r"(?<=\d)[ ,.](?=\d{3}\b)", "", t)  # 1 000 € / 1,000 € → 1000 €
    valeur = None
    for motif in (BUDGET_UNITE, BUDGET_DEVISE, BUDGET_MOT):
        m = motif.search(t)
        if m:
            valeur = _prix(next(g for g in m.groups() if g))
            break
    if valeur is None and attendu:
        m = re.fullmatch(rf"(?:about|around|environ|max(?:imum)?|budget)?\s*{MONTANT}\s*{DEVISE}?", t)
        if m:
            valeur = _prix(m.group(1))
    if valeur is None:
        return None
    if TOTAL.search(t):
        duree = nuits or (7 if re.search(r"week|semaine", t) else None)
        if duree:
            valeur = valeur / duree
    return round(valeur, 2) if 10 <= valeur <= 20_000 else None


def _jour(an: str | None, mois: int, jour: int, ref: date) -> date | None:
    try:
        if an:
            annee = int(an) + (2000 if len(an) == 2 else 0)
            return date(annee, mois, jour)
        d = date(ref.year, mois, jour)
        return d if d >= ref else date(ref.year + 1, mois, jour)
    except ValueError:
        return None


def _jour_mois_num(a: str, b: str, an: str | None, ref: date) -> date | None:
    """« 12/07 » = 12 juillet ; « 07/15 » (format US, mois impossible) = 15 juillet."""
    jour, mois = int(a), int(b)
    if mois > 12 >= jour:
        jour, mois = mois, jour
    return _jour(an, mois, jour, ref)


def _weekend(ref: date, decalage: int = 0) -> tuple[date, date]:
    """Vendredi → dimanche du week-end en cours (ou du suivant si decalage=7)."""
    arrivee = ref if ref.weekday() in (4, 5) else ref + timedelta(days=(4 - ref.weekday()) % 7)
    arrivee += timedelta(days=decalage)
    return arrivee, arrivee + timedelta(days=6 - arrivee.weekday())


def extraire_dates(t: str, ref: date | None = None) -> tuple[dict, list[tuple[int, int]]]:
    """({"arrivee", "depart", "nuits"} trouvés, positions des dates dans le texte normalisé)."""
    ref = ref or date.today()
    arrivee = depart = None
    spans: list[tuple[int, int]] = []

    for motif, lecture in (
        (PLAGE_J_MOIS, lambda g: (_jour(g[3], MOIS[g[2]], int(g[0]), ref), _jour(g[3], MOIS[g[2]], int(g[1]), ref))),
        (PLAGE_MOIS_J, lambda g: (_jour(g[3], MOIS[g[0]], int(g[1]), ref), _jour(g[3], MOIS[g[0]], int(g[2]), ref))),
        (PLAGE_NUM, lambda g: (_jour_mois_num(g[0], g[2], g[3], ref), _jour_mois_num(g[1], g[2], g[3], ref))),
    ):
        m = motif.search(t)
        if m:
            arrivee, depart = lecture(m.groups())
            spans.append(m.span())
            break
    if arrivee is None:
        trouvees = []
        for motif, lecture in (
            (DATE_ISO, lambda g: _jour(g[0], int(g[1]), int(g[2]), ref)),
            (DATE_NUM, lambda g: _jour_mois_num(g[0], g[1], g[2], ref)),
            (DATE_J_MOIS, lambda g: _jour(g[2], MOIS[g[1]], int(g[0]), ref)),
            (DATE_MOIS_J, lambda g: _jour(g[2], MOIS[g[0]], int(g[1]), ref)),
        ):
            for m in motif.finditer(t):
                if any(m.start() < fin and debut < m.end() for debut, fin in spans):
                    continue
                d = lecture(m.groups())
                if d:
                    trouvees.append((m.start(), d))
                    spans.append(m.span())
        trouvees.sort()
        if trouvees:
            arrivee = trouvees[0][1]
            depart = trouvees[1][1] if len(trouvees) > 1 else None
    for motif, decalage in ((WEEKEND_PROCHAIN, 7), (CE_WEEKEND, 0)):
        m = motif.search(t)
        if arrivee is None and m:
            arrivee, depart = _weekend(ref, decalage)
            spans.append(m.span())

    nuits = None
    m = DUREE_NUITS.search(t)
    if m:
        nuits = _n(m.group(1))
        spans.append(m.span())
    elif (m := DUREE_SEMAINES.search(t)):
        nuits = 7 * (_n(m.group(1)) if m.group(1) else 1)
        spans.append(m.span())
    elif UN_WEEKEND.search(t) and arrivee is None:
        nuits = 2

    if arrivee and depart and depart <= arrivee and depart.year == arrivee.year:
        depart = depart.replace(year=depart.year + 1) if depart.month < arrivee.month else None
    if arrivee and depart:
        nuits = (depart - arrivee).days
    elif arrivee and nuits:
        depart = arrivee + timedelta(days=nuits)

    resultat: dict = {}
    if arrivee and arrivee >= ref and arrivee <= ref + timedelta(days=730):
        resultat["arrivee"] = arrivee.isoformat()
        if depart:
            resultat["depart"] = depart.isoformat()
    if nuits and 1 <= nuits <= MAX_NUITS and (arrivee is None or "arrivee" in resultat):
        resultat["nuits"] = nuits
    return resultat, spans


def extraire_sejour(texte: str, attendu: str | None = None, ref: date | None = None) -> dict:
    """Critères d'un séjour : voyageurs, budget_max (€/nuit), arrivee, depart, nuits ;
    plus "sans_budget" / "dates_flexibles" quand l'utilisateur passe la question."""
    t = normaliser(texte)
    criteres, spans = extraire_dates(t, ref)
    reste = t
    for debut, fin in sorted(spans, reverse=True):  # les dates ne sont ni des voyageurs ni des prix
        reste = reste[:debut] + " " * (fin - debut) + reste[fin:]
    reste = re.sub(r"\s+", " ", reste).strip()

    voyageurs = extraire_voyageurs(reste, attendu == "voyageurs")
    if voyageurs:
        criteres["voyageurs"] = voyageurs
    budget = extraire_budget(reste, attendu == "budget", criteres.get("nuits"))
    if budget:
        criteres["budget_max"] = budget
    elif SANS_LIMITE.search(t) or (attendu == "budget" and PASSER.search(t)):
        criteres["sans_budget"] = True
    if not any(k in criteres for k in ("arrivee", "nuits")) and (
            DATES_FLEXIBLES_EXPLICITE.search(t)
            or (attendu == "dates" and (DATES_FLEXIBLES.search(t) or PASSER.search(t)))):
        criteres["dates_flexibles"] = True
    return criteres
