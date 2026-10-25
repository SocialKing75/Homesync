# =============================================================================
# backend/chat/sejour.py — Conversation du profil « Vacancier » (profil=holiday)
# =============================================================================
# Parcours : destination (parmi le catalogue de locations de vacances) →
# voyageurs → budget par nuit → dates (facultatives) → résultats. Chaque
# question est posée une fois ; « No limit / Peu importe » et « Flexible dates /
# Dates flexibles » la passent. Phrases comprises en anglais et en français,
# réponses dans la langue `lang`. Les dates sont gardées mais ne filtrent rien :
# la disponibilité se vérifie sur l'annonce.
# Résultats enregistrés comme en mode achat (search_id ; détail servi à tous par
# GET /api/chat/resultats/{id}) ; état dans la session de chat,
# sous la clé "sejour" (le parcours achat de la même session n'est pas touché).
# =============================================================================

from __future__ import annotations

import re
from datetime import date

from backend.chat import agent, garde_fous
from backend.vacances import catalogue
from backend.vacances.extraction import SANS_LIMITE, extraire_sejour, normaliser

MAX_LIEUX = 3

NOUVELLE = re.compile(r"\b(?:new search|start (?:again|over)|restart|reset|nouvelle recherche|recommencer|"
                      r"tout recommencer|on recommence)\b")
AFFINER = re.compile(r"\b(?:refine|modify|edit|change my search|affiner|modifier|ajuster)\b")
AUGMENTER = re.compile(r"\b(?:increase (?:the |my )?budget|higher budget|raise (?:the |my )?budget|more budget|"
                       r"augmenter (?:le |mon )?budget|budget plus eleve)\b")
CHANGER = {
    "villes": re.compile(r"\b(?:change (?:the |my )?(?:destination|city|place)|another (?:destination|city|place)|"
                         r"other (?:destination|city)|changer (?:de |la |ma )?(?:destination|ville)|"
                         r"autre (?:destination|ville))\b"),
    "voyageurs": re.compile(r"\b(?:change (?:the )?(?:number of )?(?:travell?ers|guests|people)|"
                            r"changer (?:le nombre )?(?:de |des )?(?:voyageurs|personnes))\b"),
    "budget": re.compile(r"\b(?:change (?:the |my )?budget|changer (?:de |le |mon )?budget)\b"),
    "dates": re.compile(r"\b(?:change (?:the |my )?dates?|changer (?:de |les |mes )?dates?)\b"),
}
CLES = {"villes": ("villes",), "voyageurs": ("voyageurs",), "budget": ("budget_max",),
        "dates": ("arrivee", "depart", "nuits")}

MOIS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

TEXTES = {
    "fr": {
        "bonjour": "Bonjour ! ",
        "villes": "Où souhaitez-vous séjourner ? Destinations : {liste}.",
        "trop_de_villes": "Vous pouvez choisir jusqu'à {max} destinations. Lesquelles vous intéressent le plus ?",
        "indisponible": "{lieu} n'est pas encore disponible. Destinations : {liste}.",
        "voyageurs": "C'est noté : {lieux}. Combien de voyageurs ?",
        "budget": "Noté. Quel est votre budget maximum par nuit ?",
        "dates": "Avez-vous des dates ? (facultatif : la disponibilité se vérifie sur chaque annonce)",
        "affiner": "Que souhaitez-vous modifier ?",
        "trouve": "J'ai trouvé {n} location{s} ({resume}){note}.",
        "dispo_dates": " La disponibilité pour vos dates se vérifie sur chaque annonce.",
        "dispo": " La disponibilité se vérifie sur chaque annonce.",
        "swiper": " Swipez-les dès maintenant !",
        "aucun": "Aucune location ne correspond à votre recherche ({resume}). "
                 "Essayez un budget plus élevé ou une autre destination.",
        "region": " — j'ai élargi la recherche à {zones}",
        "moins_cher": " Pour votre groupe, la moins chère y est à {prix}/nuit.",
        "trop_grand": " Aucune location n'y accueille {n} voyageurs.",
        "budget_plus": " — en acceptant jusqu'à 10 % de plus que votre budget",
        "s_voyageurs": ["1 personne", "2 personnes", "4 personnes", "6 personnes"],
        "s_budget": ["80 €", "150 €", "250 €", "Peu importe"],
        "s_dates": ["Dates flexibles", "Ce week-end"],
        "s_resultats": ["Affiner ma recherche", "Changer de destination"],
        "s_aucun": ["Augmenter le budget", "Peu importe le budget", "Changer de destination"],
        "s_aucun_sans_budget": ["Changer de destination", "Changer le nombre de voyageurs"],
        "s_affiner": ["Changer de destination", "Changer le nombre de voyageurs", "Changer de budget", "Changer de dates"],
        "voyageur": "voyageur", "nuit": "nuit", "et": "et",
    },
    "en": {
        "bonjour": "Hi! ",
        "villes": "Where would you like to stay? Destinations: {liste}.",
        "trop_de_villes": "You can pick up to {max} destinations. Which ones interest you most?",
        "indisponible": "{lieu} isn't available yet. Destinations: {liste}.",
        "voyageurs": "Noted: {lieux}. How many travellers?",
        "budget": "Noted. What's your maximum budget per night?",
        "dates": "Do you have dates in mind? (optional: availability is checked on each listing)",
        "affiner": "What would you like to change?",
        "trouve": "I found {n} rental{s} ({resume}){note}.",
        "dispo_dates": " Availability for your dates is checked on each listing.",
        "dispo": " Availability is checked on each listing.",
        "swiper": " Swipe them now!",
        "aucun": "No rental matches your search ({resume}). Try a higher budget or another destination.",
        "region": " — I widened the search to the whole {zones}",
        "moins_cher": " For your group, the cheapest one there is {prix}/night.",
        "trop_grand": " No rental there can host {n} travellers.",
        "budget_plus": " — including places up to 10% over your budget",
        "s_voyageurs": ["1 person", "2 people", "4 people", "6 people"],
        "s_budget": ["€80", "€150", "€250", "No limit"],
        "s_dates": ["Flexible dates", "This weekend"],
        "s_resultats": ["Refine my search", "Change destination"],
        "s_aucun": ["Increase budget", "No limit", "Change destination"],
        "s_aucun_sans_budget": ["Change destination", "Change travellers"],
        "s_affiner": ["Change destination", "Change travellers", "Change budget", "Change dates"],
        "voyageur": "traveller", "nuit": "night", "et": "and",
    },
}


def _liste(lieux: list[str], lang: str) -> str:
    noms = [catalogue.libelle_lieu(lieu, lang) for lieu in lieux]
    return noms[0] if len(noms) == 1 else f"{', '.join(noms[:-1])} {TEXTES[lang]['et']} {noms[-1]}"


def _date(iso: str, lang: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} {MOIS_EN[d.month - 1]}" if lang == "en" else f"{d.day:02d}/{d.month:02d}"


def resume(c: dict, lang: str = "fr") -> str:
    """« Paris · 2 voyageurs · ≤ 150 €/nuit · 12/07 → 15/07 (3 nuits) »."""
    T = TEXTES[lang]
    morceaux = []
    if c.get("villes"):
        morceaux.append(_liste(c["villes"], lang))
    if c.get("voyageurs"):
        n = c["voyageurs"]
        morceaux.append(f"{n} {T['voyageur']}{'s' if n > 1 else ''}")
    if c.get("budget_max"):
        morceaux.append(f"≤ €{c['budget_max']:,.0f}/night" if lang == "en"
                        else f"≤ {c['budget_max']:,.0f} €/nuit".replace(",", " "))
    nuits = c.get("nuits")
    duree = f"{nuits} {T['nuit']}{'s' if nuits and nuits > 1 else ''}" if nuits else ""
    if c.get("arrivee") and c.get("depart"):
        morceaux.append(f"{_date(c['arrivee'], lang)} → {_date(c['depart'], lang)}" + (f", {duree}" if duree else ""))
    elif c.get("arrivee"):
        morceaux.append(("from " if lang == "en" else "à partir du ") + _date(c["arrivee"], lang))
    elif duree:
        morceaux.append(duree)
    return " · ".join(morceaux)


def _choix_lieux(lang: str) -> dict:
    return {"type": "villes", "options": [catalogue.libelle_lieu(l, lang) for l in catalogue.options_lieux()],
            "max": MAX_LIEUX}


def _apercu(annonces: list[dict]) -> dict:
    """Aperçu affiché dans la conversation (le détail complet : GET /api/chat/resultats/{id})."""
    prix = [a["prix"] for a in annonces if a.get("prix")]
    return {
        "count": len(annonces),
        "prix_min": min(prix) if prix else None,
        "prix_max": max(prix) if prix else None,
        "unite_prix": "nuit",
        "items": [{"type": a.get("type"), "ville": a.get("ville"), "quartier": a.get("quartier"),
                   "voyageurs": a.get("voyageurs")} for a in annonces[:3]],
    }


def _reponse(reply: str, c: dict, missing: list[str], suggestions: list[str], lang: str, **options) -> dict:
    return {**agent._reponse(reply, c, missing, suggestions, **options), "profil": "holiday", "lang": lang}


def repondre(session_id: str, message: str, exclure: set[str] = frozenset(), connecte: bool = False,
             lang: str = "fr") -> dict:
    lang = "en" if lang == "en" else "fr"
    s = agent._charger_session(session_id)
    etat = s.setdefault("sejour", {})
    etat.setdefault("criteres", {})
    etat.setdefault("attendu", None)
    etat.setdefault("demandes", [])
    controle = garde_fous.controler(message, s["nb"], profil="holiday", lang=lang)
    s["nb"] += 1
    try:
        if controle["bloque"]:
            return _reponse(controle["bloque"], etat["criteres"], [], [], lang)
        reponse = _repondre(etat, session_id, controle["message"], exclure, connecte, lang, premier=s["nb"] <= 1)
        if controle["avertissements"]:
            reponse["reply"] = " ".join([reponse["reply"], *controle["avertissements"]])
        return reponse
    finally:
        agent._sauver_session(session_id, s)


def _repondre(etat: dict, session_id: str, message: str, exclure: set[str], connecte: bool, lang: str,
              premier: bool = False) -> dict:
    T = TEXTES[lang]
    t = normaliser(message)
    c = etat["criteres"]
    demandes = set(etat["demandes"])
    attendu = etat["attendu"]

    def poser(question: str) -> None:
        etat["attendu"] = question
        demandes.add(question)
        etat["demandes"] = sorted(demandes)

    # Commandes des boutons : nouvelle recherche, changer un critère, augmenter le budget
    if NOUVELLE.search(t):
        c.clear()
        demandes.clear()
        attendu = None
    change = [q for q, motif in CHANGER.items() if motif.search(t)]
    for question in change:
        for cle in CLES[question]:
            c.pop(cle, None)
        demandes.discard(question)
        attendu = None
    if AUGMENTER.search(t) and c.get("budget_max"):
        c["budget_max"] = round(c["budget_max"] * 1.25, -1)
        demandes.add("budget")

    lieux, absents = catalogue.extraire_lieux(message, agent.villes_disponibles())
    nouveaux = extraire_sejour(message, attendu)
    if len(lieux) > MAX_LIEUX:
        etat["attendu"] = "villes"
        etat["demandes"] = sorted(demandes)
        return _reponse(T["trop_de_villes"].format(max=MAX_LIEUX), c, ["villes"], [], lang, choix=_choix_lieux(lang))
    if lieux:
        c["villes"] = lieux
    if nouveaux.pop("sans_budget", False) or SANS_LIMITE.search(t):
        c.pop("budget_max", None)
        demandes.add("budget")
    if nouveaux.pop("dates_flexibles", False):
        for cle in CLES["dates"]:
            c.pop(cle, None)
        demandes.add("dates")
    if any(k in nouveaux for k in CLES["dates"]):
        for cle in CLES["dates"]:
            c.pop(cle, None)  # nouvelles dates : remplacent les précédentes
        demandes.add("dates")
    c.update(nouveaux)
    etat["demandes"] = sorted(demandes)

    if AFFINER.search(t) and not (lieux or nouveaux or change):
        etat["attendu"] = None
        return _reponse(T["affiner"], c, [], T["s_affiner"], lang)

    # Questions : destination (obligatoire), voyageurs, budget, dates (une fois chacune)
    destinations = catalogue.destinations()
    if absents and c.get("villes"):  # « Nice » alors que Paris est déjà choisi : on le dit, on garde Paris
        etat["attendu"] = "villes"
        return _reponse(T["indisponible"].format(lieu=absents[0], liste=_liste(destinations, lang)), c, ["villes"],
                        [catalogue.libelle_lieu(d, lang) for d in destinations], lang, choix=_choix_lieux(lang))
    if not c.get("villes"):
        poser("villes")
        if absents:
            texte = T["indisponible"].format(lieu=absents[0], liste=_liste(destinations, lang))
        else:
            texte = (T["bonjour"] if premier else "") + T["villes"].format(liste=_liste(destinations, lang))
        return _reponse(texte, c, ["villes"], [catalogue.libelle_lieu(d, lang) for d in destinations], lang,
                        choix=_choix_lieux(lang))
    if not c.get("voyageurs") and "voyageurs" not in demandes:
        poser("voyageurs")
        return _reponse(T["voyageurs"].format(lieux=_liste(c["villes"], lang)), c, ["voyageurs"], T["s_voyageurs"], lang)
    if not c.get("budget_max") and "budget" not in demandes:
        poser("budget")
        return _reponse(T["budget"], c, ["budget"], T["s_budget"], lang)
    if not (c.get("arrivee") or c.get("nuits")) and "dates" not in demandes:
        poser("dates")
        return _reponse(T["dates"], c, ["dates"], T["s_dates"], lang)
    etat["attendu"] = None

    annonces, assouplissement = catalogue.rechercher(c, exclure, lang)
    if not annonces:
        sans_budget = catalogue.filtrer({k: v for k, v in c.items() if k != "budget_max"}, exclure, region=True)
        if c.get("budget_max") and sans_budget:
            piste = T["moins_cher"].format(prix=catalogue._eur(min(a["prix"] for a in sans_budget), lang))
        else:
            piste = T["trop_grand"].format(n=c["voyageurs"]) if c.get("voyageurs") and not sans_budget else ""
        return _reponse(T["aucun"].format(resume=resume(c, lang)) + piste, c, [],
                        T["s_aucun"] if c.get("budget_max") else T["s_aucun_sans_budget"], lang)

    criteres = {**c, "profil": "holiday", "lang": lang}
    search_id = agent.enregistrer_recherche(session_id, criteres, annonces)
    apercu = _apercu(annonces)
    n = apercu["count"]
    note = ""
    if assouplissement:
        zones = sorted({catalogue.destination_de(l) or l for l in c["villes"]})
        note = T["region"].format(zones=_liste(zones, lang) if lang == "en" else _tout(zones))
        if assouplissement == "budget":
            note = (note if any(l not in destinations for l in c["villes"]) else "") + T["budget_plus"]
    texte = (T["trouve"].format(n=n, s="s" if n > 1 else "", resume=resume(c, lang), note=note)
             + (T["dispo_dates"] if c.get("arrivee") else T["dispo"])
             + T["swiper"])
    return _reponse(texte, c, [], T["s_resultats"], lang, resultats={"search_id": search_id, **apercu}, complete=True)


def _tout(zones: list[str]) -> str:
    """« tout le Pays Basque », « tout Paris »."""
    return ", ".join(f"tout le {z}" if z.startswith("Pays ") else f"tout {z}" for z in zones)
