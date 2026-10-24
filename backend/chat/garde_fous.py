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


def controler(message: str, nb_messages: int) -> dict:
    """Résultat : {"bloque": réponse | None, "message": texte nettoyé, "avertissements": [...]}"""
    if nb_messages >= MAX_MESSAGES_SESSION:
        return {"bloque": "Cette conversation est terminée. Créez un compte ou lancez une nouvelle recherche pour continuer.",
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
