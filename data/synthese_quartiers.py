import csv
import json
import os
import time
from collections import defaultdict
from pathlib import Path

from mistralai import Mistral

# Charge le fichier .env
_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def normalise_quartier(nom: str) -> str:
    """Nettoie les noms du type 'Toulon (Saint-Roch)' → 'Saint-Roch'."""
    nom = nom.strip()
    if nom.startswith("Toulon (") and nom.endswith(")"):
        return nom[8:-1]
    return nom


def stats_quartier(biens: list) -> dict:
    """Calcule les statistiques d'un quartier."""
    prix_m2_vals = []
    prix_vals = []
    surfaces = []

    for b in biens:
        try:
            prix_m2_vals.append(float(b["prix_m2"]))
        except (ValueError, TypeError):
            pass
        try:
            prix_vals.append(float(b["prix"]))
        except (ValueError, TypeError):
            pass
        try:
            s = b["surface"].replace("m²", "").strip()
            if "à" in s:
                parts = s.split("à")
                surfaces.append((float(parts[0].strip()) + float(parts[1].strip())) / 2)
            else:
                surfaces.append(float(s))
        except (ValueError, TypeError):
            pass

    types = sorted({b.get("type", "") for b in biens if b.get("type")})

    return {
        "nb_annonces": len(biens),
        "prix_m2_moyen": round(sum(prix_m2_vals) / len(prix_m2_vals)) if prix_m2_vals else None,
        "prix_m2_min": round(min(prix_m2_vals)) if prix_m2_vals else None,
        "prix_m2_max": round(max(prix_m2_vals)) if prix_m2_vals else None,
        "prix_moyen": round(sum(prix_vals) / len(prix_vals)) if prix_vals else None,
        "surface_moyenne": round(sum(surfaces) / len(surfaces)) if surfaces else None,
        "types": types,
    }


def generate_summary(client: Mistral, quartier: str, stats: dict, exemples: list) -> str:
    """Génère une synthèse via Mistral avec retry sur rate limit."""
    exemples_txt = "\n".join(f"- {e}" for e in exemples[:5])

    prompt = f"""Tu es un expert immobilier à Toulon. Rédige une synthèse professionnelle et concise (3 phrases max) du quartier "{quartier}".

Données disponibles :
- Nombre d'annonces : {stats['nb_annonces']}
- Prix/m² moyen : {stats['prix_m2_moyen']} € (min {stats['prix_m2_min']} € | max {stats['prix_m2_max']} €)
- Prix moyen : {stats['prix_moyen']} €
- Surface moyenne : {stats['surface_moyenne']} m²
- Types de biens : {', '.join(stats['types'])}
- Exemples :
{exemples_txt}

Synthèse (mentionne le positionnement prix, le type de biens dominant, et l'attractivité du quartier) :"""

    for attempt in range(4):
        try:
            response = client.chat.complete(
                model="mistral-small-latest",
                max_tokens=250,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            if "429" in str(e) and attempt < 3:
                wait = 15 * (attempt + 1)
                print(f"    Rate limit, attente {wait}s...")
                time.sleep(wait)
            else:
                print(f"    Erreur: {e}")
                return ""
    return ""


def synthese_quartiers(input_file=None, output_file=None):
    if input_file is None:
        base = Path(__file__).parent.parent
        # Préfère le fichier enrichi s'il existe
        enriched = base / "data" / "annonces_enrichies.csv"
        input_file = str(enriched) if enriched.exists() else str(base / "data" / "annoncetest.csv")
    if output_file is None:
        output_file = str(Path(__file__).parent.parent / "data" / "synthese_quartiers.json")

    print(f"Lecture de : {input_file}")
    with open(input_file, encoding="utf-8") as f:
        annonces = list(csv.DictReader(f))

    # Grouper par quartier normalisé
    by_quartier = defaultdict(list)
    for a in annonces:
        q = normalise_quartier(a.get("quartier", ""))
        if q:
            by_quartier[q].append(a)

    print(f"{len(by_quartier)} quartiers détectés\n")

    client = Mistral(api_key=os.environ.get("MISTRAL"))
    results = {}

    for i, (quartier, biens) in enumerate(sorted(by_quartier.items()), 1):
        stats = stats_quartier(biens)
        exemples = [
            f"{b['titre']} – {b['prix']}€ ({b.get('prix_m2', '?')} €/m²)"
            for b in biens
        ]

        print(f"[{i}/{len(by_quartier)}] {quartier} ({stats['nb_annonces']} biens, {stats['prix_m2_moyen']} €/m²)...")
        synthese = generate_summary(client, quartier, stats, exemples)

        results[quartier] = {**stats, "synthese": synthese}
        time.sleep(2)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Synthèse de {len(results)} quartiers → {output_file}")
    return results


if __name__ == "__main__":
    import sys
    input_file = sys.argv[1] if len(sys.argv) > 1 else None
    synthese_quartiers(input_file)
