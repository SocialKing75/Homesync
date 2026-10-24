# =============================================================================
# test_smoke.py — Quick smoke test for the ToulonFindAI backend
# =============================================================================
# Validates that:
#   1. All modules import cleanly.
#   2. The sample CSV loads successfully.
#   3. Every PropertyService method returns a non-None, well-shaped result.
#
# Run with:   python -m pytest tests/test_smoke.py -v
# =============================================================================

import os
import sys

# Ensure project root is importable
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.models.data_models import Property, BuyerProfile, MarketStats
from backend.loaders.csv_loader import load_properties_from_csv
from backend.analysis.stats import mean, median, std_dev, compute_market_stats
from backend.analysis.regression import (
    SimpleLinearRegression,
    MultipleLinearRegression,
    predict_property_value,
)
from backend.analysis.scoring import score_property, detect_opportunities
from backend.analysis.recommendation import create_buyer_profile, recommend_properties
from backend.services.property_service import PropertyService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DATA_PATH = os.path.join(PROJECT_ROOT, "data", "raw", "toulon_properties.csv")


def _service() -> PropertyService:
    return PropertyService(data_path=DATA_PATH)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_load_properties():
    """CSV loads and returns at least one Property."""
    props = load_properties_from_csv(DATA_PATH)
    assert len(props) > 0
    assert isinstance(props[0], Property)


def test_price_per_m2_auto_computed():
    """price_per_m2 is automatically filled in __post_init__."""
    p = Property(id=999, district="Test", property_type="apartment",
                 surface_m2=100, rooms=3, price=200000)
    assert p.price_per_m2 == 2000.0


def test_stats_mean_median():
    """Primitive stats helpers work on simple inputs."""
    assert mean([10, 20, 30]) == 20.0
    assert median([10, 20, 30]) == 20.0
    assert median([10, 20]) == 15.0


def test_market_statistics():
    """compute_market_stats returns a populated MarketStats."""
    svc = _service()
    stats = svc.get_market_statistics()
    assert isinstance(stats, MarketStats)
    assert stats.total_properties > 0
    assert stats.avg_price > 0
    assert len(stats.by_district) > 0


def test_predict_property_value():
    """Prediction returns a positive price and an R² value."""
    svc = _service()
    result = svc.predict_property_value({
        "surface_m2": 80,
        "rooms": 3,
        "floor": 2,
        "year_built": 2000,
        "distance_to_center_km": 2.5,
    })
    assert result["predicted_price"] > 0
    assert 0 <= result["r_squared"] <= 1


def test_score_property():
    """Scoring returns a composite score between 0 and 100."""
    svc = _service()
    result = svc.score_property({
        "id": 1,
        "district": "Le Mourillon",
        "property_type": "apartment",
        "surface_m2": 70,
        "rooms": 3,
        "price": 200000,
    })
    assert 0 <= result["composite_score"] <= 100


def test_detect_opportunities():
    """Opportunity detection returns a list (may be empty)."""
    svc = _service()
    opps = svc.detect_opportunities()
    assert isinstance(opps, list)


def test_buyer_recommendations():
    """Recommendations for a broad profile return at least one result."""
    svc = _service()
    profile = svc.create_buyer_profile(
        budget_max=500000,
        min_surface=40,
        min_rooms=2,
        preferred_districts=["Le Mourillon", "Centre-Ville"],
    )
    recs = svc.recommend_properties_for_buyer(profile)
    assert isinstance(recs, list)
    assert len(recs) > 0
    assert "combined_score" in recs[0]


def test_simple_linear_regression():
    """SimpleLinearRegression fits a trivial line."""
    model = SimpleLinearRegression()
    model.fit([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])
    assert abs(model.predict(6) - 12.0) < 0.01
    assert model.r_squared > 0.99


def test_multiple_linear_regression():
    """MultipleLinearRegression fits a 2-feature plane."""
    X = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]
    y = [1, 1, 2, 3, 3]
    model = MultipleLinearRegression()
    model.fit(X, y)
    # Prediction should be in a reasonable range
    pred = model.predict([2, 2])
    assert pred > 0
