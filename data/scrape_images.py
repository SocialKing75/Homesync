import csv
import json
import re
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
    "Accept": "application/json, text/html, */*",
    "Referer": "https://www.bienici.com/",
}


def fetch(url: str, timeout: int = 10) -> tuple[str, int]:
    """Retourne (contenu, status_code). Contenu vide si erreur réseau."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="ignore"), r.status
    except urllib.error.HTTPError as e:
        return "", e.code
    except Exception:
        return "", 0


def bienici_annonce_id(url: str) -> str:
    """Extrait l'ID depuis une URL bienici. Ex: .../hektor-mourillon-388222?q=... → hektor-mourillon-388222"""
    path = url.split("?")[0].rstrip("/")
    return path.split("/")[-1]


def _parse_bienici_date(data: dict) -> str:
    """Extrait et formate la date de publication depuis la réponse API Bienici."""
    MOIS = {
        1: "janvier", 2: "février", 3: "mars", 4: "avril",
        5: "mai", 6: "juin", 7: "juillet", 8: "août",
        9: "septembre", 10: "octobre", 11: "novembre", 12: "décembre",
    }
    raw = data.get("modificationDate") or data.get("thresholdDate", "")
    if not raw or raw.startswith("1970"):
        return ""
    try:
        # Format: 2026-03-07T05:06:03.342Z
        parts = raw[:10].split("-")
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
        return f"{d} {MOIS[m]} {y}"
    except Exception:
        return ""


def get_bienici_image(annonce_url: str) -> tuple[str, str, str]:
    """Interroge l'API bienici pour récupérer la première photo et la date.
    Retourne (image_url, status, date_publication).
    """
    annonce_id = bienici_annonce_id(annonce_url)
    api_url = f"https://www.bienici.com/realEstateAd.json?id={annonce_id}"

    content, status = fetch(api_url)

    if status == 404:
        return "", "annonce_supprimee", ""
    if not content:
        return "", "erreur", ""

    try:
        data = json.loads(content)
        date_pub = _parse_bienici_date(data)
        photos = data.get("photos", [])
        if photos:
            url = photos[0].get("url", "")
            if url:
                return url + "?width=600&height=370&fit=cover", "ok", date_pub
    except (json.JSONDecodeError, KeyError):
        pass

    return "", "erreur", ""


def extract_og_image(html: str) -> str:
    """Extrait l'URL depuis la balise meta og:image."""
    for pattern in [
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
    ]:
        match = re.search(pattern, html)
        if match:
            return match.group(1)
    return ""


def get_seloger_image(annonce_url: str) -> tuple[str, str]:
    """Scrape seloger via og:image ou JSON-LD."""
    content, status = fetch(annonce_url)

    if status == 404:
        return "", "annonce_supprimee"
    if not content:
        return "", "erreur"

    # JSON-LD
    for block in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.+?)</script>', content, re.DOTALL):
        try:
            data = json.loads(block)
            for item in (data if isinstance(data, list) else [data]):
                if item.get("@type") in ("Product", "RealEstateListing"):
                    img = item.get("image")
                    if isinstance(img, list) and img:
                        return img[0], "ok"
                    if isinstance(img, str) and img:
                        return img, "ok"
        except (json.JSONDecodeError, AttributeError):
            pass

    # Fallback og:image
    img = extract_og_image(content)
    if img:
        return img, "ok"

    return "", "erreur"


def get_image_url(annonce_url: str) -> tuple[str, str, str]:
    """
    Retourne (image_url, status, date_publication)
    - image_url       : URL de la miniature ou ""
    - status          : "ok" | "erreur" | "annonce_supprimee"
    - date_publication: "7 mars 2026" ou ""
    """
    if not annonce_url or not annonce_url.startswith("http"):
        return "", "erreur", ""

    if "bienici.com" in annonce_url:
        return get_bienici_image(annonce_url)

    if "seloger.com" in annonce_url:
        img, status = get_seloger_image(annonce_url)
        return img, status, ""

    # Site inconnu : tentative og:image
    content, status = fetch(annonce_url)
    if status == 404:
        return "", "annonce_supprimee", ""
    img = extract_og_image(content) if content else ""
    return (img, "ok", "") if img else ("", "erreur", "")


def enrich_with_images(input_file=None, output_file=None):
    base = Path(__file__).parent.parent

    if input_file is None:
        input_file = base / "data" / "annoncetest.csv"
    if output_file is None:
        output_file = base / "data" / "annonces_images.csv"

    with open(input_file, encoding="utf-8") as f:
        annonces = list(csv.DictReader(f))

    print(f"=== Scraping images pour {len(annonces)} annonces ===\n")

    results = []
    stats = {"ok": 0, "erreur": 0, "annonce_supprimee": 0}

    for i, annonce in enumerate(annonces):
        url = annonce.get("url", "")
        print(f"[{i+1}/{len(annonces)}] {annonce.get('titre', '')[:45]}...")

        image_url, status, date_pub = get_image_url(url)
        stats[status] += 1
        print(f"  -> {status} | {image_url[:80] if image_url else '(aucune)'}")

        results.append({**annonce, "image_url": image_url, "image_status": status, "date_publication": date_pub})
        time.sleep(1.2)

    fields = list(annonces[0].keys()) + ["image_url", "image_status", "date_publication"]
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)

    print(f"\n✅ {output_file}")
    print(f"   ok: {stats['ok']} | erreur: {stats['erreur']} | supprimées: {stats['annonce_supprimee']}")
    return results


if __name__ == "__main__":
    import sys
    input_file = sys.argv[1] if len(sys.argv) > 1 else None
    enrich_with_images(input_file)
