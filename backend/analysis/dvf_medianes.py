# =============================================================================
# dvf_medianes.py — Médianes de prix au m² par quartier (transactions DVF)
# =============================================================================
# Lit les fichiers DVF data/raw/83137_*.csv (Toulon), rattache chaque vente au
# quartier le plus proche puis écrit data/dvf_medianes.csv.
#
# Usage : python -m backend.analysis.dvf_medianes
# =============================================================================

import csv
import math
from pathlib import Path
from statistics import mean, median

ROOT = Path(__file__).resolve().parents[2]
RAW_FOLDER = ROOT / "data" / "raw"
OUTPUT_FILE = ROOT / "data" / "dvf_medianes.csv"

QUARTIERS_TOULON = {
    "Mourillon":     (43.1189, 5.9441),
    "Centre-ville":  (43.1247, 5.9302),
    "Haute-ville":   (43.1268, 5.9280),
    "Saint-Roch":    (43.1198, 5.9198),
    "Sainte-Anne":   (43.1150, 5.9050),
    "Pont du Las":   (43.1320, 5.9150),
    "Siblas":        (43.1380, 5.9220),
    "Valbertrand":   (43.1420, 5.9350),
    "Saint-Jean":    (43.1100, 5.9320),
    "Aguillon":      (43.1280, 5.9420),
    "La Rode":       (43.1350, 5.9480),
    "Bon Rencontre": (43.1230, 5.9350),
}


def distance_km(lat1, lon1, lat2, lon2):
    """Distance haversine en kilomètres."""
    r = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


def assign_quartier(lat, lon):
    return min(QUARTIERS_TOULON, key=lambda q: distance_km(lat, lon, *QUARTIERS_TOULON[q]))


def _ventes(rows: list[dict]) -> list[tuple[float, float, float]]:
    """(prix_m2, lat, lon) de chaque vente exploitable.

    DVF répète la valeur foncière de la mutation sur chaque ligne (une ligne par
    local, parcelle ou culture) : les lignes sont regroupées par id_mutation et
    une vente en bloc est ramenée à la surface totale de ses logements. Sont
    écartées les mutations avec un local commercial (prix non comparable) et
    celles qui ne sont pas des ventes (adjudication, échange, expropriation).
    """
    mutations: dict[str, dict] = {}
    for n, row in enumerate(rows):
        m = mutations.setdefault(row.get("id_mutation") or f"ligne-{n}", {"locaux": {}, "exclue": False})
        type_local = row.get("type_local") or ""
        if type_local.startswith("Local") or not (row.get("nature_mutation") or "Vente").startswith("Vente"):
            m["exclue"] = True
        if type_local not in ("Appartement", "Maison"):
            continue
        try:
            prix, surface, lat, lon = (float(row[k].replace(",", "."))
                                       for k in ("valeur_fonciere", "surface_reelle_bati", "latitude", "longitude"))
        except (KeyError, ValueError, AttributeError):
            continue
        m.update(prix=prix, lat=lat, lon=lon)
        m["locaux"][(row.get("id_parcelle"), row.get("lot1_numero"), type_local, surface)] = surface

    ventes = []
    for m in mutations.values():
        surface = sum(m["locaux"].values())
        if m["exclue"] or surface <= 0 or m["prix"] <= 0 or not m["lat"] or not m["lon"]:
            continue
        prix_m2 = m["prix"] / surface
        # Filtre anti-aberrations : entre 500 et 15 000 €/m²
        if 500 <= prix_m2 <= 15000:
            ventes.append((prix_m2, m["lat"], m["lon"]))
    return ventes


def compute_dvf_medianes(output_file: Path = OUTPUT_FILE) -> list[dict]:
    rows: list[dict] = []
    for filepath in sorted(RAW_FOLDER.glob("83137*.csv")):
        with filepath.open(encoding="utf-8") as f:
            rows.extend(csv.DictReader(f))
    ventes = _ventes(rows)
    quartiers: dict[str, list[float]] = {}
    for prix_m2, lat, lon in ventes:
        quartiers.setdefault(assign_quartier(lat, lon), []).append(prix_m2)

    print(f"{len(rows)} lignes DVF chargées, {len(ventes)} ventes exploitables")

    resultats = [
        {
            "quartier": quartier,
            "mediane_prix_m2": round(median(valeurs)),
            "moyenne_prix_m2": round(mean(valeurs)),
            "nb_transactions": len(valeurs),
            "prix_m2_min": round(min(valeurs)),
            "prix_m2_max": round(max(valeurs)),
        }
        for quartier, valeurs in quartiers.items()
        if len(valeurs) >= 3
    ]
    resultats.sort(key=lambda x: x["mediane_prix_m2"], reverse=True)

    with output_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(resultats[0].keys()) if resultats else ["quartier"])
        writer.writeheader()
        writer.writerows(resultats)

    for r in resultats:
        print(f"  {r['quartier']} : {r['mediane_prix_m2']} €/m² ({r['nb_transactions']} transactions)")
    return resultats


if __name__ == "__main__":
    compute_dvf_medianes()
