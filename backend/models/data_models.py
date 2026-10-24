# =============================================================================
# data_models.py — Core domain data classes
# =============================================================================
# Defines the three principal data structures used across every layer:
#   • Property     — a single real-estate listing
#   • BuyerProfile — a prospective buyer's search criteria
#   • MarketStats  — aggregated market-level statistics
#
# All classes are plain Python dataclasses so they stay serialisable and
# framework-agnostic (no Streamlit or ORM dependency).
# =============================================================================

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class Property:
    """Represents a single real-estate listing in the Toulon area.

    Attributes:
        id:                    Unique identifier.
        district:              Toulon neighbourhood (e.g. "Le Mourillon").
        property_type:         "apartment" or "house".
        surface_m2:            Living area in m².
        rooms:                 Number of rooms.
        price:                 Listing price in euros.
        price_per_m2:          Derived price per square metre.
        has_garden:            Whether the property has a garden.
        has_parking:           Whether parking is included.
        floor:                 Floor number (0 = ground / house).
        year_built:            Construction year.
        distance_to_center_km: Distance to Toulon city centre.
    """
    id: int
    district: str
    property_type: str
    surface_m2: float
    rooms: int
    price: float
    price_per_m2: float = 0.0
    has_garden: bool = False
    has_parking: bool = False
    floor: int = 0
    year_built: int = 2000
    distance_to_center_km: float = 0.0

    def __post_init__(self):
        """Auto-compute price_per_m2 if not provided."""
        if self.price_per_m2 == 0.0 and self.surface_m2 > 0:
            self.price_per_m2 = round(self.price / self.surface_m2, 2)


@dataclass
class BuyerProfile:
    """Search criteria for a prospective property buyer.

    Each field acts as a filter or preference used by the recommendation
    engine to rank matching properties.
    """
    budget_max: float
    min_surface: float = 0.0
    min_rooms: int = 1
    preferred_districts: List[str] = field(default_factory=list)
    needs_parking: bool = False
    needs_garden: bool = False
    max_distance_to_center: float = float("inf")


@dataclass
class DistrictStats:
    """Aggregated statistics for a single district."""
    district: str
    count: int
    avg_price: float
    avg_price_per_m2: float
    median_price: float


@dataclass
class MarketStats:
    """Market-level statistics computed over a set of properties.

    Attributes:
        total_properties: Number of properties analysed.
        avg_price:        Mean listing price.
        median_price:     Median listing price.
        variance_price:   Variance of prices.
        std_price:        Standard deviation of prices.
        avg_price_per_m2: Mean price per m².
        price_range:      Tuple (min_price, max_price).
        by_district:      Per-district breakdowns.
    """
    total_properties: int = 0
    avg_price: float = 0.0
    median_price: float = 0.0
    variance_price: float = 0.0
    std_price: float = 0.0
    avg_price_per_m2: float = 0.0
    price_range: tuple = (0.0, 0.0)
    by_district: Dict[str, DistrictStats] = field(default_factory=dict)
