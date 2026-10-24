"""
Enrichit annonces_images.csv avec les descriptions depuis l'API Bienici.
Lit annonces_images.csv, met à jour la colonne 'description', sauvegarde sur place.
"""

import csv
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Accept": "application/json, */*",
    "Referer": "https://www.bienici.com/",
}

BASE = Path(__file__).parent.parent
INPUT_FILE = BASE / "data" / "annonces_images.csv"


def fetch_json(url: str, timeout: int = 10) -> dict | None:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def bienici_annonce_id(url: str) -> str:
    path = url.split("?")[0].rstrip("/")
    return path.split("/")[-1]


def get_description(url: str) -> str:
    """Récupère la description d'une annonce Bienici via l'API JSON."""
    if not url or "bienici.com" not in url:
        return ""
    annonce_id = bienici_annonce_id(url)
    api_url = f"https://www.bienici.com/realEstateAd.json?id={annonce_id}"
    data = fetch_json(api_url)
    if data:
        return data.get("description", "").strip()
    return ""


def enrich():
    with open(INPUT_FILE, encoding="utf-8") as f:
        annonces = list(csv.DictReader(f))

    fieldnames = list(annonces[0].keys())
    if "description" not in fieldnames:
        fieldnames.append("description")

    total = len(annonces)
    enriched = 0
    skipped = 0

    print(f"=== Enrichissement descriptions pour {total} annonces ===\n", flush=True)

    for i, row in enumerate(annonces):
        titre = row.get("titre", "")[:45]
        url = row.get("url", "")
        existing = row.get("description", "").strip()

        if existing:
            print(f"[{i+1}/{total}] SKIP (déjà rempli) — {titre}", flush=True)
            skipped += 1
            continue

        print(f"[{i+1}/{total}] {titre}...", flush=True)
        desc = get_description(url)

        if desc:
            row["description"] = desc
            enriched += 1
            print(f"  -> ok ({len(desc)} car.)", flush=True)
        else:
            print(f"  -> vide", flush=True)

        time.sleep(0.8)

    # Sauvegarde
    with open(INPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(annonces)

    print(f"\n✅ Sauvegardé dans {INPUT_FILE}", flush=True)
    print(f"   enrichies: {enriched} | déjà remplies: {skipped} | vides: {total - enriched - skipped}", flush=True)


if __name__ == "__main__":
    enrich()
