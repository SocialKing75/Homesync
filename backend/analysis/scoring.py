# =============================================================================
# scoring.py — Property scoring & opportunity detection
# =============================================================================
# Scores individual properties against market averages and flags those that
# appear to be undervalued.
#
# Scoring dimensions:
#   1. Price-per-m² deviation from district average.
#   2. Price deviation from district median.
#   3. Surface bonus (larger for the price → higher score).
#   4. Amenity bonus (garden / parking).
#
# The combined score is a simple weighted sum (easy to adjust or extend).
# =============================================================================

from typing import Dict, List

from backend.models.data_models import MarketStats, Property


# ---------------------------------------------------------------------------
# Weights for the composite score (easy to change / expose via config)
# ---------------------------------------------------------------------------
WEIGHT_PRICE_M2_DEVIATION = 0.40    # How much cheaper per m² vs. district avg
WEIGHT_PRICE_DEVIATION    = 0.30    # How much cheaper vs. district median
WEIGHT_SURFACE_BONUS      = 0.15    # Larger surface for the price
WEIGHT_AMENITY_BONUS      = 0.15    # Garden + parking bonus

# A property is flagged as an "opportunity" if its composite score exceeds
# this threshold (on a 0–100 scale).
OPPORTUNITY_THRESHOLD = 60.0


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    """Clamp a numeric value between *lo* and *hi*."""
    return max(lo, min(hi, value))


def score_property(prop: Property, market_stats: MarketStats) -> Dict:
    """Score a single property relative to the current market.

    Returns a dict with individual dimension scores, the composite score,
    and a boolean `is_opportunity` flag.
    """
    district_info = market_stats.by_district.get(prop.district)

    # --- Price per m² deviation ---
    if district_info and district_info.avg_price_per_m2 > 0:
        pct_cheaper_m2 = (
            (district_info.avg_price_per_m2 - prop.price_per_m2)
            / district_info.avg_price_per_m2
        ) * 100
    else:
        pct_cheaper_m2 = 0.0
    score_price_m2 = _clamp(50 + pct_cheaper_m2)   # 50 = at average

    # --- Price deviation from median ---
    if district_info and district_info.median_price > 0:
        pct_cheaper_price = (
            (district_info.median_price - prop.price)
            / district_info.median_price
        ) * 100
    else:
        pct_cheaper_price = 0.0
    score_price = _clamp(50 + pct_cheaper_price)

    # --- Surface bonus ---
    # Compare surface to an "expected" surface for the given price
    if market_stats.avg_price_per_m2 > 0:
        expected_surface = prop.price / market_stats.avg_price_per_m2
        surface_ratio = (prop.surface_m2 / expected_surface) * 50 if expected_surface > 0 else 50
    else:
        surface_ratio = 50.0
    score_surface = _clamp(surface_ratio)

    # --- Amenity bonus ---
    amenity_pts = 0.0
    if prop.has_garden:
        amenity_pts += 50.0
    if prop.has_parking:
        amenity_pts += 50.0
    score_amenity = _clamp(amenity_pts)

    # --- Composite ---
    composite = (
        WEIGHT_PRICE_M2_DEVIATION * score_price_m2
        + WEIGHT_PRICE_DEVIATION * score_price
        + WEIGHT_SURFACE_BONUS * score_surface
        + WEIGHT_AMENITY_BONUS * score_amenity
    )

    return {
        "property_id": prop.id,
        "district": prop.district,
        "price": prop.price,
        "score_price_m2": round(score_price_m2, 2),
        "score_price": round(score_price, 2),
        "score_surface": round(score_surface, 2),
        "score_amenity": round(score_amenity, 2),
        "composite_score": round(composite, 2),
        "is_opportunity": composite >= OPPORTUNITY_THRESHOLD,
    }


def detect_opportunities(
    properties: List[Property],
    market_stats: MarketStats,
    threshold: float = OPPORTUNITY_THRESHOLD,
) -> List[Dict]:
    """Return scored dicts for properties whose composite score ≥ *threshold*.

    Results are sorted by composite score descending (best opportunities first).
    """
    scored = [score_property(p, market_stats) for p in properties]
    opportunities = [s for s in scored if s["composite_score"] >= threshold]
    opportunities.sort(key=lambda s: s["composite_score"], reverse=True)
    return opportunities
