# =============================================================================
# property_service.py — Service façade
# =============================================================================
# PropertyService wires together loaders and analysis modules into a single,
# high-level API that the Streamlit frontend (or any other consumer) can call
# without knowing the internal structure of the backend.
#
# Design notes:
#   • The service is stateful — it loads properties once and caches them.
#   • All public methods return plain dicts / dataclasses so the caller does
#     not need to import analysis internals.
#   • Future services (e.g. eligibility simulation, external API wrappers)
#     should follow the same pattern: a class that encapsulates one domain.
# =============================================================================

import os
from typing import Dict, List, Optional

from backend.models.data_models import BuyerProfile, MarketStats, Property
from backend.loaders.csv_loader import load_properties_from_csv
from backend.analysis.stats import compute_market_stats
from backend.analysis.regression import predict_property_value
from backend.analysis.scoring import score_property, detect_opportunities
from backend.analysis.recommendation import (
    create_buyer_profile,
    recommend_properties,
)


# Default path to the unified sample dataset (relative to project root).
_DEFAULT_DATA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "annonces_images.csv"
)


class PropertyService:
    """High-level façade consumed by the Streamlit UI.

    Example:
        >>> svc = PropertyService()
        >>> props = svc.load_properties()
        >>> stats = svc.get_market_statistics()
        >>> print(stats.avg_price)
    """

    def __init__(self, data_path: Optional[str] = None):
        self._data_path = data_path or os.path.abspath(_DEFAULT_DATA_PATH)
        self._properties: Optional[List[Property]] = None
        self._market_stats: Optional[MarketStats] = None

    # ------------------------------------------------------------------
    # Data loading
    # ------------------------------------------------------------------

    def load_properties(self) -> List[Property]:
        """Load (and cache) the property dataset.

        Subsequent calls return the cached list unless reload() is called.
        """
        if self._properties is None:
            self._properties = load_properties_from_csv(self._data_path)
            # Invalidate cached stats when data changes
            self._market_stats = None
        return self._properties

    def reload(self) -> List[Property]:
        """Force-reload properties from disk."""
        self._properties = None
        self._market_stats = None
        return self.load_properties()

    # ------------------------------------------------------------------
    # Market analytics
    # ------------------------------------------------------------------

    def get_market_statistics(self) -> MarketStats:
        """Return aggregated market statistics (cached after first call)."""
        if self._market_stats is None:
            props = self.load_properties()
            self._market_stats = compute_market_stats(props)
        return self._market_stats

    # ------------------------------------------------------------------
    # Price prediction
    # ------------------------------------------------------------------

    def predict_property_value(self, property_data: Dict) -> Dict:
        """Train a regression model on the dataset and predict for *property_data*.

        Args:
            property_data: Dict with keys matching feature names
                           (surface_m2, rooms, floor, year_built,
                            distance_to_center_km).

        Returns:
            Dict with predicted_price, r_squared, coefficients.
        """
        props = self.load_properties()
        return predict_property_value(property_data, props)

    # ------------------------------------------------------------------
    # Scoring & opportunities
    # ------------------------------------------------------------------

    def score_property(self, property_data: Dict) -> Dict:
        """Score a single property described by *property_data*.

        Accepts either a Property object or a dict. If a dict is provided it
        is converted to a Property for scoring.
        """
        stats = self.get_market_statistics()

        if isinstance(property_data, Property):
            prop = property_data
        else:
            prop = Property(
                id=int(property_data.get("id", 0)),
                district=property_data.get("district", "Unknown"),
                property_type=property_data.get("property_type", "apartment"),
                surface_m2=float(property_data.get("surface_m2", 0)),
                rooms=int(property_data.get("rooms", 1)),
                price=float(property_data.get("price", 0)),
                has_garden=bool(property_data.get("has_garden", False)),
                has_parking=bool(property_data.get("has_parking", False)),
                floor=int(property_data.get("floor", 0)),
                year_built=int(property_data.get("year_built", 2000)),
                distance_to_center_km=float(
                    property_data.get("distance_to_center_km", 0)
                ),
            )
        return score_property(prop, stats)

    def detect_opportunities(self, threshold: float = 60.0) -> List[Dict]:
        """Return properties flagged as undervalued opportunities."""
        props = self.load_properties()
        stats = self.get_market_statistics()
        return detect_opportunities(props, stats, threshold=threshold)

    # ------------------------------------------------------------------
    # Buyer recommendations
    # ------------------------------------------------------------------

    def create_buyer_profile(self, **kwargs) -> BuyerProfile:
        """Create a BuyerProfile from keyword arguments.

        Accepted kwargs: budget_max, min_surface, min_rooms,
        preferred_districts, needs_parking, needs_garden,
        max_distance_to_center.
        """
        return create_buyer_profile(**kwargs)

    def recommend_properties_for_buyer(
        self,
        profile: BuyerProfile,
        max_results: int = 10,
    ) -> List[Dict]:
        """Return a ranked list of property recommendations for *profile*."""
        props = self.load_properties()
        stats = self.get_market_statistics()
        return recommend_properties(profile, props, stats, max_results=max_results)
