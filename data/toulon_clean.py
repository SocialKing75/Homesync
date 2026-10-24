import csv
import os


def clean_annonces(input_file=None, output_file=None):
    if input_file is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        input_file = os.path.join(base, "data", "toulon_listings.csv")
    if output_file is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_file = os.path.join(base, "data", "annonces.csv")

    with open(input_file, encoding="utf-8") as f:
        content = f.read()

    def remove_newlines_in_quotes(text):
        result = []
        in_quotes = False
        for char in text:
            if char == '"':
                in_quotes = not in_quotes
                result.append(char)
            elif char == '\n' and in_quotes:
                pass
            else:
                result.append(char)
        return ''.join(result)

    cleaned = remove_newlines_in_quotes(content)

    annonces = []
    reader = csv.DictReader(cleaned.splitlines())
    for row in reader:
        annonce = {
            "titre": row.get("Title", "").strip(),
            "prix": row.get("Price (€)", "").strip(),
            "surface": row.get("Surface Area (m²)", "").strip(),
            "quartier": row.get("Neighborhood", "").strip(),
            "type": row.get("Property Type", "").strip(),
            "url": row.get("Listing URL", "").strip(),
        }
        if annonce["titre"] and annonce["prix"]:
            annonces.append(annonce)

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        fields = ["titre", "prix", "surface", "quartier", "type", "url"]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(annonces)

    print(f"{len(annonces)} annonces nettoyées sauvegardées dans {output_file}")
    return annonces


if __name__ == "__main__":
    annonces = clean_annonces()
    if annonces:
        print("Exemple :", annonces[0])