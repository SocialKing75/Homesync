# =============================================================================
# backend/chat/garde_fous.py — Garde-fous du chatbot public (landing page)
# =============================================================================
# Appliqués à chaque message AVANT l'agent :
#   1. Insultes / propos haineux                → refus poli, rien n'est traité
#   2. Tentatives de détournement (injection)   → refus, rappel du rôle
#   3. Hors sujet évident (recette, code, …)    → recentrage sur l'immobilier
#   4. Données personnelles (email, tél., IBAN, carte) → masquées avant tout
#      traitement/stockage + avertissement
#   5. Conseil financier / juridique / fiscal   → avertissement ajouté à la réponse
# Plus, côté routes : longueur max, champ piège, délai minimum, limite par IP,
# nombre de messages max par conversation.
# =============================================================================

import re
import unicodedata

MAX_MESSAGES_SESSION = 40


def _norm(texte: str) -> str:
    texte = unicodedata.normalize("NFD", texte.casefold())
    return "".join(c for c in texte if unicodedata.category(c) != "Mn")


INSULTES = re.compile(
    r"\b(connard|connasse|salope|encule|batard|pute|fdp|ntm|nique|merde|abruti|debile|"
    r"idiot|cretin|negro|bougnoule|youpin|pd|tg|ta gueule)\b"
)

INJECTION = re.compile(
    r"(ignore[rz]? (toutes |tes |les |vos )?(precedentes |anciennes )?(instructions|consignes|regles)|"
    r"oublie (tes|les|toutes) (instructions|consignes|regles)|prompt systeme|system prompt|"
    r"tu es (maintenant|desormais)|fais comme si tu etais|jailbreak|\bdan\b|mode developpeur|"
    r"revele (ton|tes) (prompt|instructions)|<\s*script|select .* from|drop table)"
)

HORS_SUJET = re.compile(
    r"\b(recette|cuisine[rz]?|meteo|horoscope|blague|football|match|politique|election|"
    r"code python|javascript|programme(r)? en|devoirs?|dissertation|traduis|traduction|"
    r"poeme|chanson|film|serie netflix|jeu video|bitcoin|crypto)\b"
)

IMMOBILIER = re.compile(
    r"\b(appart|maison|villa|studio|t[1-6]|pieces?|m2|m²|budget|prix|quartier|ville|"
    r"achat|acheter|louer|investi|jardin|terrasse|balcon|piscine|garage|parking|annonce|bien)\w*"
)

CONSEIL = re.compile(
    r"\b(credit|pret|emprunt|taux|notaire|impots?|fiscal|defiscalis|pinel|lmnp|"
    r"succession|juridique|avocat|bon investissement|rentabilite garantie)\w*"
)

DONNEES_PERSO = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[email masqué]"),
    (re.compile(r"\bFR\d{2}(?:\s?\d{4}){5}\s?\d{3}\b", re.IGNORECASE), "[IBAN masqué]"),
    (re.compile(r"\b(?:\d[ -]?){13,16}\b"), "[numéro masqué]"),
    (re.compile(r"(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}\b"), "[téléphone masqué]"),
]

AVERTISSEMENT_CONSEIL = (
    "Je vous aide à trouver des annonces, mais je ne donne pas de conseil financier, "
    "fiscal ou juridique : pour un crédit, une fiscalité ou un acte, rapprochez-vous "
    "d'un professionnel (banque, courtier, notaire)."
)


def masquer_donnees_perso(message: str) -> tuple[str, bool]:
    masque = message
    for motif, remplacement in DONNEES_PERSO:
        masque = motif.sub(remplacement, masque)
    return masque, masque != message


def controler(message: str, nb_messages: int, profil: str = "perso", lang: str = "fr") -> dict:
    """Résultat : {"bloque": réponse | None, "message": texte nettoyé, "avertissements": [...]}
    profil="holiday" : garde-fous du parcours séjour, réponses dans la langue `lang`."""
    if profil == "holiday":
        return _controler_sejour(message, nb_messages, lang)
    if nb_messages >= MAX_MESSAGES_SESSION:
        return {"bloque": "Cette conversation est terminée. Lancez une nouvelle recherche pour continuer.",
                "message": "", "avertissements": []}

    t = _norm(message)
    if INSULTES.search(t):
        return {"bloque": "Restons courtois, s'il vous plaît. Je suis là pour vous aider à trouver un bien immobilier.",
                "message": "", "avertissements": []}
    if INJECTION.search(t):
        return {"bloque": "Je ne peux pas faire ça. Mon rôle est uniquement de vous aider à trouver des annonces immobilières.",
                "message": "", "avertissements": []}
    if HORS_SUJET.search(t) and not IMMOBILIER.search(t):
        return {"bloque": "Je suis spécialisé dans la recherche immobilière. Dites-moi plutôt quelle ville et quel type de bien vous intéressent !",
                "message": "", "avertissements": []}

    nettoye, masque = masquer_donnees_perso(message)
    avertissements = []
    if masque:
        avertissements.append("Pour votre sécurité, je n'enregistre pas vos coordonnées : ne les partagez pas dans ce chat.")
    if CONSEIL.search(t):
        avertissements.append(AVERTISSEMENT_CONSEIL)
    return {"bloque": None, "message": nettoye, "avertissements": avertissements}


# --- Parcours séjour (profil « Vacancier ») : mêmes contrôles, en anglais et en français ---
# Pas d'avertissement « conseil financier » : il ne concerne pas une location de vacances
# (et « prêt » y veut souvent dire « ready »).

INSULTES_EN = re.compile(r"\b(fuck\w*|shit\w*|bitch\w*|asshole|bastard|cunt|dickhead|moron|stupid bot|retard\w*|"
                         r"nigg\w*|fag\w*|whore|slut)\b")

INJECTION_EN = re.compile(
    r"(ignore (all |any |the |your )?(previous |prior |above |earlier )?(instructions|rules|prompts?)|"
    r"forget (all |your |the )?(instructions|rules|prompts?)|disregard (all |your |the )?(instructions|rules)|"
    r"you are now|pretend (to be|you are)|act as (a|an|if)|reveal (your|the) (system )?(prompt|instructions)|"
    r"developer mode|print (your|the) (system )?prompt)"
)

HORS_SUJET_EN = re.compile(
    r"\b(recipe|cooking|weather forecast|horoscope|joke|football|soccer|politics|election|python code|javascript|"
    r"homework|essay|translate|poem|song lyrics|movie|netflix|video game|bitcoin|crypto)\b"
)

SEJOUR = re.compile(
    r"\b(rent\w*|stay\w*|holiday\w*|vacation\w*|trip|travel\w*|night\w*|guests?|people|flat|apartment|house|villa|"
    r"studio|room\w*|bed\w*|airbnb|accommodation|sejour\w*|vacances|voyage\w*|nuit\w*|personnes?|logement\w*|"
    r"location\w*|appart\w*|maison|chambre\w*|budget|prix|price|week-?end|paris|lyon|bordeaux|basque|biarritz|"
    r"bayonne|anglet|plage|beach|mer|sea)\b"
)

MESSAGES_SEJOUR = {
    "fr": {
        "fin": "Cette conversation est terminée. Lancez une nouvelle recherche pour continuer.",
        "insulte": "Restons courtois, s'il vous plaît. Je suis là pour vous aider à trouver une location de vacances.",
        "injection": "Je ne peux pas faire ça. Mon rôle est uniquement de vous aider à trouver une location de vacances.",
        "hors_sujet": "Je suis spécialisé dans les locations de vacances. Dites-moi plutôt où vous souhaitez séjourner !",
        "donnees": "Pour votre sécurité, je n'enregistre pas vos coordonnées : ne les partagez pas dans ce chat.",
    },
    "en": {
        "fin": "This conversation has ended. Start a new search to continue.",
        "insulte": "Let's keep it polite, please. I'm here to help you find a holiday rental.",
        "injection": "I can't do that. I can only help you find holiday rentals.",
        "hors_sujet": "I specialise in holiday rentals. Tell me where you'd like to stay!",
        "donnees": "For your safety, I don't store contact details: please don't share them in this chat.",
    },
}


def _controler_sejour(message: str, nb_messages: int, lang: str) -> dict:
    textes = MESSAGES_SEJOUR["en" if lang == "en" else "fr"]
    if nb_messages >= MAX_MESSAGES_SESSION:
        return {"bloque": textes["fin"], "message": "", "avertissements": []}
    t = _norm(message)
    if INSULTES.search(t) or INSULTES_EN.search(t):
        return {"bloque": textes["insulte"], "message": "", "avertissements": []}
    if INJECTION.search(t) or INJECTION_EN.search(t):
        return {"bloque": textes["injection"], "message": "", "avertissements": []}
    if (HORS_SUJET.search(t) or HORS_SUJET_EN.search(t)) and not (IMMOBILIER.search(t) or SEJOUR.search(t)):
        return {"bloque": textes["hors_sujet"], "message": "", "avertissements": []}
    nettoye, masque = masquer_donnees_perso(message)
    return {"bloque": None, "message": nettoye, "avertissements": [textes["donnees"]] if masque else []}
