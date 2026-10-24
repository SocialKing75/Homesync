# =============================================================================
# backend/rag/assistant.py — Assistant immobilier RAG
# =============================================================================
# 1. Comprend la question (type, budget, objectif)
# 2. Retrouve les annonces pertinentes dans ChromaDB
# 3. Construit un prompt conseiller et génère l'analyse avec le LLM local
#    (Ollama) — repli sur une analyse à base de règles si le LLM est absent.
#
# Usage CLI : python -m backend.rag.assistant "T3 Mourillon moins de 300k"
# =============================================================================

from __future__ import annotations

import re

from backend.loaders.annonces_loader import charger_annonces_csv, _to_float
from backend.rag import llm_client
from backend.rag.vector_store import get_collection, index_annonces, search_similar

SYSTEM_PROMPT = (
    "Tu es un conseiller immobilier IA spécialisé sur le marché de Toulon. "
    "Tu es factuel, concis, et tu justifies tes recommandations par des données chiffrées. "
    "Tu ne spécules pas sur l'avenir du marché et ne donnes pas de conseil juridique ou fiscal."
)


def indexer_si_vide() -> int:
    """Remplit ChromaDB depuis data/annonces_bienici.csv si la collection est vide."""
    collection = get_collection()
    if collection.count() == 0:
        index_annonces(charger_annonces_csv())
    return collection.count()


def comprendre_question(user_query: str) -> dict:
    """Extrait quelques critères simples depuis la phrase utilisateur."""
    query = user_query.casefold()
    type_bien = None
    match_type = re.search(r"\bt\s*([1-6])\b", query)
    if match_type:
        type_bien = f"T{match_type.group(1)}"

    budget_max = None
    match_budget = re.search(r"(?:moins de|<|max(?:imum)?|budget)\s*(\d+(?:[.,]\d+)?)\s*k", query)
    if match_budget:
        budget_max = float(match_budget.group(1).replace(",", ".")) * 1000
    else:
        match_budget = re.search(r"(?:moins de|<|max(?:imum)?|budget)\s*(\d[\d\s]{3,})", query)
        if match_budget:
            budget_max = float(match_budget.group(1).replace(" ", ""))

    ville = "Toulon" if "toulon" in query else None
    objectif = "investissement" if any(w in query for w in ("investir", "investissement", "rentable", "locatif")) else "achat"
    return {"type_bien": type_bien, "ville": ville, "budget_max": budget_max, "objectif": objectif}


def _respecte_criteres(annonce: dict, criteres: dict) -> bool:
    if criteres.get("ville") and str(annonce.get("ville", "")).casefold() != criteres["ville"].casefold():
        return False
    prix = _to_float(annonce.get("prix"))
    if criteres.get("budget_max") and prix and prix > criteres["budget_max"]:
        return False
    if criteres.get("type_bien"):
        type_query = criteres["type_bien"].casefold()
        type_annonce = str(annonce.get("type", "")).casefold()
        pieces = annonce.get("nb_pieces")
        if type_query not in type_annonce and str(pieces or "") != type_query.replace("t", ""):
            return False
    return True


def retrouver_bonnes_annonces(user_query: str, n_results: int = 5) -> list[dict]:
    """Recherche large dans l'index puis filtre sur les critères explicites."""
    indexer_si_vide()
    annonces = search_similar(user_query, n=n_results * 4)
    criteres = comprendre_question(user_query)
    filtrees = [a for a in annonces if _respecte_criteres(a, criteres)]
    return (filtrees or annonces)[:n_results]


def construire_prompt(user_query: str, biens: list[dict]) -> str:
    lignes = [
        "Objectif : aider l'utilisateur à choisir les annonces les plus pertinentes "
        "en expliquant les opportunités, les risques et les prochaines actions.",
        "",
        "Méthode d'analyse interne :",
        "1. Identifier le besoin : type de bien, budget, ville, quartier, objectif.",
        "2. Comparer chaque annonce aux critères explicites de la question.",
        "3. Évaluer les opportunités : prix, surface, localisation, potentiel locatif, cohérence prix/m².",
        "4. Évaluer les risques : DPE absent, photos insuffisantes, travaux possibles, informations manquantes.",
        "5. Prioriser les biens et donner une recommandation claire.",
        "",
        "N'affiche pas ton raisonnement étape par étape. Donne seulement une réponse utile et structurée.",
        "",
        "Format attendu :",
        "- Résumé de la demande",
        "- Top recommandations classées",
        "- Opportunités",
        "- Risques / points à vérifier",
        "- Recommandation finale",
        "",
        "Voici les biens retrouvés par le RAG :",
    ]
    for index, bien in enumerate(biens, start=1):
        lignes.append(
            "- Bien {idx}: {type_bien}, {surface} m2, {ville}, {quartier}, "
            "{prix} EUR, {pieces} pièces. Description: {description}. URL: {url}".format(
                idx=index,
                type_bien=bien.get("type") or "bien",
                surface=bien.get("surface") or "surface inconnue",
                ville=bien.get("ville") or "ville inconnue",
                quartier=bien.get("quartier") or "quartier inconnu",
                prix=bien.get("prix") or "prix inconnu",
                pieces=bien.get("nb_pieces") or "nombre inconnu",
                description=(bien.get("description") or "")[:220],
                url=bien.get("url_source") or "",
            )
        )
    lignes.extend([
        "",
        f"Question : {user_query}",
        "",
        "Réponds en français. Sois concret, factuel, et cite les biens par numéro.",
        "Si une information manque, signale-la comme point à vérifier au lieu de l'inventer.",
    ])
    return "\n".join(lignes)


def repondre_avec_analyse(user_query: str, biens: list[dict]) -> str:
    """Réponse de secours basée sur des règles, si le LLM n'est pas disponible."""
    criteres = comprendre_question(user_query)
    if not biens:
        return (
            "Je n'ai pas trouvé d'annonce assez proche dans la base. "
            "Essayez une recherche plus large, par exemple : T3 Toulon investissement."
        )

    lignes = ["Voici les biens les plus pertinents pour votre recherche."]
    for index, bien in enumerate(biens, start=1):
        prix, surface = _to_float(bien.get("prix")), _to_float(bien.get("surface"))
        prix_m2 = prix / surface if prix and surface else None
        opportunites, risques = [], []

        if criteres.get("budget_max") and prix and prix <= criteres["budget_max"]:
            opportunites.append("prix compatible avec le budget")
        if criteres.get("objectif") == "investissement":
            opportunites.append("potentiel locatif à vérifier selon le quartier et les charges")
        if prix_m2:
            opportunites.append(f"prix au m² estimé à {prix_m2:,.0f} EUR/m²")
        if not bien.get("dpe"):
            risques.append("DPE non renseigné")
        if not bien.get("photos_count"):
            risques.append("peu ou pas de photos")
        if prix is None:
            risques.append("prix manquant")

        lignes.append("")
        lignes.append(f"Proposition {index} - {bien.get('type') or 'Bien'} à {bien.get('quartier') or bien.get('ville')}")
        lignes.append(f"Prix: {bien.get('prix') or 'non renseigné'} EUR | Surface: {bien.get('surface') or 'non renseignée'} m² | Pièces: {bien.get('nb_pieces') or 'non renseigné'}")
        lignes.append("Opportunités: " + "; ".join(opportunites or ["annonce pertinente par rapport à la question"]))
        lignes.append("Risques: " + "; ".join(risques or ["à vérifier : charges, DPE, travaux, copropriété"]))
        lignes.append("Recommandation: comparer le prix au m² avec le quartier, demander les charges et vérifier la rentabilité nette.")
        if bien.get("url_source"):
            lignes.append(f"URL: {bien['url_source']}")

    lignes.append("")
    lignes.append("Synthèse : privilégiez les biens qui respectent le budget, ont un DPE clair, assez de photos et un prix au m² cohérent pour Toulon.")
    return "\n".join(lignes)


def assistant_immobilier(user_query: str, n_results: int = 5) -> dict:
    biens = retrouver_bonnes_annonces(user_query, n_results=n_results)
    prompt = construire_prompt(user_query, biens)
    try:
        reponse = llm_client.generate_text(prompt, system=SYSTEM_PROMPT)
        moteur = llm_client.OLLAMA_MODEL
    except Exception:
        reponse = repondre_avec_analyse(user_query, biens)
        moteur = "regles"
    return {
        "query": user_query,
        "criteres": comprendre_question(user_query),
        "biens": biens,
        "reponse": reponse,
        "moteur": moteur,
    }


def main() -> None:
    from argparse import ArgumentParser
    parser = ArgumentParser(description="Assistant immobilier RAG (ChromaDB + Ollama)")
    parser.add_argument("query", help="Question utilisateur")
    parser.add_argument("--n-results", type=int, default=5)
    args = parser.parse_args()
    print(assistant_immobilier(args.query, n_results=args.n_results)["reponse"])


if __name__ == "__main__":
    main()
