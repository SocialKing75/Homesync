import csv
import os


def merge_and_deduplicate(file1=None, file2=None, output_file=None):
    if file1 is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        file1 = os.path.join(base, "data", "annonces_enrichies.csv")
    if file2 is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        file2 = os.path.join(base, "data", "seloger.csv")
    if output_file is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_file = os.path.join(base, "data", "annonces_merged.csv")

    # Charger fichier 1 (bienici)
    with open(file1, encoding="utf-8") as f:
        annonces1 = list(csv.DictReader(f))
    print(f"Bienici : {len(annonces1)} annonces")

    # Charger fichier 2 (seloger)
    with open(file2, encoding="utf-8") as f:
        annonces2 = list(csv.DictReader(f))
    print(f"SeLoger : {len(annonces2)} annonces")

    # Normaliser les colonnes de seloger pour matcher bienici
    annonces2_normalized = []
    for row in annonces2:
        annonces2_normalized.append({
            "titre": row.get("titre", "").strip(),
            "prix": row.get("prix", "").strip().replace(" ", "").replace("€", "").replace("\u00a0", ""),
            "surface": row.get("surface", "").strip(),
            "quartier": row.get("quartier", "").strip(),
            "type": row.get("type", "").strip(),
            "url": row.get("url", "").strip(),
            "prix_m2": "",
        })

    # Fusionner et dédoublonner par URL
    seen_urls = set()
    merged = []

    for annonce in annonces1:
        url = annonce.get("url", "").strip()
        if url and url not in seen_urls:
            seen_urls.add(url)
            merged.append(annonce)

    doublons = 0
    for annonce in annonces2_normalized:
        url = annonce.get("url", "").strip()
        if url and url not in seen_urls:
            seen_urls.add(url)
            merged.append(annonce)
        else:
            doublons += 1

    print(f"Doublons supprimés : {doublons}")
    print(f"Total après fusion : {len(merged)} annonces")

    # Sauvegarder
    fields = ["titre", "prix", "surface", "quartier", "type", "url", "prix_m2"]
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(merged)

    print(f"✅ Fichier fusionné sauvegardé : {output_file}")
    return merged


if __name__ == "__main__":
    merge_and_deduplicate()