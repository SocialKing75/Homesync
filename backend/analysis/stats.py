# =============================================================================
# stats.py — Pure-Python descriptive statistics
# =============================================================================
# Implements mean, median, standard deviation, percentile, and a full
# market-statistics aggregation — all without numpy.
# =============================================================================

import math
from typing import List

from backend.models.data_models import DistrictStats, MarketStats, Property


# ---------------------------------------------------------------------------
# Primitive helpers
# ---------------------------------------------------------------------------

def mean(values: List[float]) -> float:
    """Arithmetic mean of a list of numbers."""
    if not values:
        return 0.0
    return sum(values) / len(values)


def median(values: List[float]) -> float:
    """Median value.  For even-length lists returns the average of the two
    middle elements."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    mid = n // 2
    if n % 2 == 0:
        return (sorted_vals[mid - 1] + sorted_vals[mid]) / 2
    return sorted_vals[mid]


def variance(values: List[float]) -> float:
    """Population variance (σ²)."""
    if len(values) < 2:
        return 0.0
    avg = mean(values)
    var = sum((x - avg) ** 2 for x in values) / len(values)
    return var


def std_dev(values: List[float]) -> float:
    """Population standard deviation (σ)."""
    return math.sqrt(variance(values))


def percentile(values: List[float], p: float) -> float:
    """Compute the *p*-th percentile (0–100) using linear interpolation."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    k = (p / 100) * (len(sorted_vals) - 1)
    f = int(k)
    c = f + 1
    if c >= len(sorted_vals):
        return sorted_vals[-1]
    return sorted_vals[f] + (k - f) * (sorted_vals[c] - sorted_vals[f])


# ---------------------------------------------------------------------------
# Market-level aggregation
# ---------------------------------------------------------------------------

def compute_market_stats(properties: List[Property]) -> MarketStats:
    """Aggregate descriptive statistics across all properties and per district.

    Returns a fully populated MarketStats dataclass.
    """
    if not properties:
        return MarketStats()

    prices = [p.price for p in properties]
    prices_m2 = [p.price_per_m2 for p in properties if p.price_per_m2 > 0]

    # --- Per-district breakdown ---
    districts: dict = {}
    for prop in properties:
        districts.setdefault(prop.district, []).append(prop)

    by_district = {}
    for district_name, district_props in districts.items():
        d_prices = [p.price for p in district_props]
        d_prices_m2 = [p.price_per_m2 for p in district_props if p.price_per_m2 > 0]
        by_district[district_name] = DistrictStats(
            district=district_name,
            count=len(district_props),
            avg_price=round(mean(d_prices), 2),
            avg_price_per_m2=round(mean(d_prices_m2), 2),
            median_price=round(median(d_prices), 2),
        )

    return MarketStats(
        total_properties=len(properties),
        avg_price=round(mean(prices), 2),
        median_price=round(median(prices), 2),
        variance_price=round(variance(prices), 2),
        std_price=round(std_dev(prices), 2),
        avg_price_per_m2=round(mean(prices_m2), 2),
        price_range=(min(prices), max(prices)),
        by_district=by_district,
    )
