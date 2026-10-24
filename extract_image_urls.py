"""
Extrait les URLs d'images du CSV pour analyse vision.
"""

import csv
from pathlib import Path

csv_path = Path("data/annonces_images.csv")
output_file = Path("data/image_urls.txt")

try:
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        urls = []

        for row in reader:
            image_url = row.get("image_url", "").strip()
            if image_url and image_url.startswith("http"):
                urls.append(image_url)

        # Sauvegarder les URLs
        with open(output_file, "w", encoding="utf-8") as out:
            for url in urls:
                out.write(url + "\n")

        print(f"OK: Extrait {len(urls)} URLs vers {output_file}")

        # Afficher les 5 premières
        print("\nPremières URLs :")
        for url in urls[:5]:
            print(f"  - {url[:80]}...")

except Exception as e:
    print(f"ERREUR : {e}")
