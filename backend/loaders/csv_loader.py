# =============================================================================
# csv_loader.py — Data ingestion layer
# =============================================================================
# Reads raw CSV files and converts each row into a Property dataclass.
# This module is the single entry-point for data into the system; any future
# data sources (API, database) should follow the same pattern of returning
# a list[Property].
# =============================================================================

import csv
import os
import hashlib
from typing import List

from backend.models.data_models import Property

# Specific 8 districts the React frontend expects
REQUIRED_QUARTIERS = [
    "Mourillon", "Centre-Ville", "Saint-Jean du Var", "La Rode",
    "Pont du Las", "Le Pradet", "La Seyne", "Siblas"
]

def _get_deterministic_quartier(adresse: str) -> str:
    """Deterministically maps an address string to one of the 8 required quartiers."""
    if not adresse:
        return "Centre-Ville"
    # Basic hashing for deterministic but distributed mapping
    hash_val = int(hashlib.md5(adresse.encode("utf-8")).hexdigest()[:8], 16)
    return REQUIRED_QUARTIERS[hash_val % len(REQUIRED_QUARTIERS)]


def _safe_float(value: str, default: float = 0.0) -> float:
    """Convert a string to float, returning *default* on failure."""
    if not isinstance(value, str):
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
            
    # Clean up currency, narrow spaces, regular spaces, and replace comma with dot
    clean_val = value.replace("€", "").replace(" ", "").replace("\u202f", "").replace("\xa0", "").strip()
    clean_val = clean_val.replace(",", ".")
    try:
        return float(clean_val)
    except (ValueError, TypeError):
        return default


def _safe_int(value: str, default: int = 0) -> int:
    """Convert a string to int, returning *default* on failure."""
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def load_properties_from_csv(filepath: str) -> List[Property]:
    """Load the annonces_enrichies CSV file and return a list of Property objects.

    Expected CSV columns (header row required):
        titre,prix,surface,quartier,type,url,prix_m2,description

    Args:
        filepath: Absolute or relative path to the CSV file.

    Returns:
        A list of Property instances, one per valid row.
    """
    if not os.path.isfile(filepath):
        print(f"Dataset not found: {filepath}")
        return []

    properties: List[Property] = []

    with open(filepath, newline="", encoding="utf-8") as fh:
        # Some rows might be malformed or missing headers in raw scrape data,
        # but DictReader usually handles it well.
        reader = csv.DictReader(fh)
        
        for i, row in enumerate(reader, start=1):
            # Support both column name formats (unified CSV and annonces_images CSV)
            prop_type_val = (row.get("property_type") or row.get("type") or "").strip()
            if not prop_type_val:
                continue

            quartier = (row.get("district") or row.get("quartier") or "Centre-Ville").strip()
            title = row.get("title") or row.get("titre") or ""

            raw_surf = row.get("surface_m2") or row.get("surface") or "0"
            parsed_surf = _safe_float(raw_surf)

            raw_price = row.get("price") or row.get("prix") or "0"

            prop = Property(
                id=i,
                district=quartier,
                property_type=prop_type_val,
                surface_m2=parsed_surf,
                rooms=1 if prop_type_val.lower() == "appartement" else 3,
                price=_safe_float(raw_price),
                has_garden=(prop_type_val.lower() == "maison"),
                has_parking=True,
                floor=0 if prop_type_val.lower() == "maison" else 2,
                year_built=2020 if "neuf" in title.lower() else 2000,
                distance_to_center_km=0.0
            )

            setattr(prop, "raw_date", row.get("date_publication", "2024-03-01"))
            setattr(prop, "url", row.get("url", ""))
            setattr(prop, "titre", title)
            setattr(prop, "description", row.get("description", ""))
            setattr(prop, "image_url", row.get("image_url", ""))

            properties.append(prop)

    return properties
