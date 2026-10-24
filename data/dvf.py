import csv
import os


def load_dvf(folder=None):
    if folder is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        folder = os.path.join(base, "data", "raw")

    transactions = []
    for filename in os.listdir(folder):
        if filename.endswith(".csv"):
            filepath = os.path.join(folder, filename)
            with open(filepath, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    transactions.append(row)

    print(f"{len(transactions)} transactions chargées")
    return transactions


def filter_dvf(transactions):
    filtered = []
    for t in transactions:
        type_bien = t.get("type_local", "")
        prix = t.get("valeur_fonciere", "")
        surface = t.get("surface_reelle_bati", "")

        if type_bien in ["Appartement", "Maison"] and prix and surface:
            filtered.append({
                "type": type_bien,
                "prix": float(prix.replace(",", ".")),
                "surface": float(surface.replace(",", ".")),
                "quartier": t.get("nom_commune", "Toulon"),
                "date": t.get("date_mutation", ""),
                "adresse": t.get("adresse_nom_voie", ""),
            })

    print(f"{len(filtered)} transactions après filtrage")
    return filtered


def save_dvf(data, output=None):
    if output is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output = os.path.join(base, "data", "dvf_toulon.csv")

    if not data:
        return

    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

    print(f"Fichier sauvegardé : {output}")


if __name__ == "__main__":
    transactions = load_dvf()
    data = filter_dvf(transactions)
    save_dvf(data)
    print("Exemple :", data[0])