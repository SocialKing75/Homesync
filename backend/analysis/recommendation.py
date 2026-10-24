# =============================================================================
# recommendation.py — Buyer-profile matching & property ranking
# =============================================================================
# Given a BuyerProfile and a set of properties, this module:
#   1. Filters properties that meet hard constraints (budget, surface, rooms …).
#   2. Scores the remaining candidates for relevance (district preference,
#      closeness to ideal, amenity match).
#   3. Returns a ranked list with explanations.
# =============================================================================

from typing import Dict, List, Optional

from backend.models.data_models import BuyerProfile, MarketStats, Property
from backend.analysis.scoring import score_property


# ---------------------------------------------------------------------------
# BuyerProfile factory (convenience)
# ---------------------------------------------------------------------------

def create_buyer_profile(
    budget_max: float,
    min_surface: float = 0.0,
    min_rooms: int = 1,
    preferred_districts: Optional[List[str]] = None,
    needs_parking: bool = False,
    needs_garden: bool = False,
    max_distance_to_center: float = float("inf"),
) -> BuyerProfile:
    """Create a BuyerProfile from keyword arguments.

    This factory allows the frontend to build profiles without importing the
    dataclass directly, keeping the boundary clean.
    """
    return BuyerProfile(
        budget_max=budget_max,
        min_surface=min_surface,
        min_rooms=min_rooms,
        preferred_districts=preferred_districts or [],
        needs_parking=needs_parking,
        needs_garden=needs_garden,
        max_distance_to_center=max_distance_to_center,
    )


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------

def _matches_hard_constraints(prop: Property, profile: BuyerProfile) -> bool:
    """Return True if the property satisfies every hard constraint."""
    if prop.price > profile.budget_max:
        return False
    if prop.surface_m2 < profile.min_surface:
        return False
    if prop.rooms < profile.min_rooms:
        return False
    if profile.needs_parking and not prop.has_parking:
        return False
    if profile.needs_garden and not prop.has_garden:
        return False
    if prop.distance_to_center_km > profile.max_distance_to_center:
        return False
    return True


# ---------------------------------------------------------------------------
# Relevance scoring (0–100)
# ---------------------------------------------------------------------------

def _relevance_score(prop: Property, profile: BuyerProfile) -> float:
    """Compute a relevance score that rewards alignment with buyer preferences.

    Dimensions:
        • Budget efficiency   — how far under budget (25 %)
        • District preference — bonus for preferred districts (25 %)
        • Surface surplus     — extra surface above minimum (20 %)
        • Room surplus        — extra rooms above minimum (15 %)
        • Distance bonus      — closer to centre is better (15 %)
    """
    # Budget efficiency: percentage of budget saved
    budget_eff = ((profile.budget_max - prop.price) / profile.budget_max) * 100
    budget_eff = max(0.0, min(100.0, budget_eff))

    # District preference
    district_score = 100.0 if prop.district in profile.preferred_districts else 30.0

    # Surface surplus
    if profile.min_surface > 0:
        surface_ratio = (prop.surface_m2 / profile.min_surface) * 50
    else:
        surface_ratio = 50.0
    surface_score = max(0.0, min(100.0, surface_ratio))

    # Room surplus
    room_score = min(100.0, (prop.rooms / max(profile.min_rooms, 1)) * 50)

    # Distance bonus (closer = better)
    if profile.max_distance_to_center < float("inf"):
        dist_ratio = 1 - (prop.distance_to_center_km / profile.max_distance_to_center)
        distance_score = max(0.0, min(100.0, dist_ratio * 100))
    else:
        distance_score = 50.0

    return (
        0.25 * budget_eff
        + 0.25 * district_score
        + 0.20 * surface_score
        + 0.15 * room_score
        + 0.15 * distance_score
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def recommend_properties(
    profile: BuyerProfile,
    properties: List[Property],
    market_stats: MarketStats,
    max_results: int = 10,
) -> List[Dict]:
    """Return a ranked list of property recommendations for a given buyer.

    Each item is a dict containing:
        - property    : the Property object
        - relevance   : buyer-relevance score (0–100)
        - market_score: composite market score from scoring.py
        - combined    : blended ranking value

    Sorted by *combined* descending.
    """
    candidates = [p for p in properties if _matches_hard_constraints(p, profile)]

    results = []
    for prop in candidates:
        relevance = _relevance_score(prop, profile)
        market = score_property(prop, market_stats)["composite_score"]

        # Blend: 60 % buyer relevance, 40 % market attractiveness
        combined = 0.60 * relevance + 0.40 * market

        results.append({
            "property": prop,
            "relevance_score": round(relevance, 2),
            "market_score": round(market, 2),
            "combined_score": round(combined, 2),
        })

    results.sort(key=lambda r: r["combined_score"], reverse=True)
    return results[:max_results]
