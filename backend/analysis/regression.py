# =============================================================================
# regression.py — OLS linear regression from scratch
# =============================================================================
# Provides a SimpleLinearRegression (single feature) and a
# MultipleLinearRegression (arbitrary number of features) using the OLS
# Normal Equation, implemented with plain Python lists — no numpy.
#
# The module also exposes a convenience function predict_property_value()
# that trains a model on the supplied dataset and returns a prediction.
# =============================================================================

from typing import Dict, List, Optional, Tuple

from backend.models.data_models import Property


# ---------------------------------------------------------------------------
# Matrix / vector helpers (pure Python)
# ---------------------------------------------------------------------------

def _dot(a: List[float], b: List[float]) -> float:
    """Dot product of two vectors."""
    return sum(x * y for x, y in zip(a, b))


def _transpose(matrix: List[List[float]]) -> List[List[float]]:
    """Transpose a 2-D list (matrix)."""
    if not matrix:
        return []
    return [list(row) for row in zip(*matrix)]


def _mat_mul(A: List[List[float]], B: List[List[float]]) -> List[List[float]]:
    """Multiply two matrices A (m×n) and B (n×p) → C (m×p)."""
    B_T = _transpose(B)
    return [[_dot(row_a, col_b) for col_b in B_T] for row_a in A]


def _mat_vec_mul(A: List[List[float]], v: List[float]) -> List[float]:
    """Multiply matrix A by column-vector v."""
    return [_dot(row, v) for row in A]


def _invert_matrix(matrix: List[List[float]]) -> List[List[float]]:
    """Invert a square matrix using Gauss-Jordan elimination.

    Raises ValueError if the matrix is singular.
    """
    n = len(matrix)
    # Augment with identity
    aug = [row[:] + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(matrix)]

    for col in range(n):
        # Partial pivot
        max_row = max(range(col, n), key=lambda r: abs(aug[r][col]))
        aug[col], aug[max_row] = aug[max_row], aug[col]

        pivot = aug[col][col]
        if abs(pivot) < 1e-12:
            raise ValueError("Singular matrix — cannot invert.")

        # Scale pivot row
        aug[col] = [x / pivot for x in aug[col]]

        # Eliminate column
        for row in range(n):
            if row == col:
                continue
            factor = aug[row][col]
            aug[row] = [aug[row][j] - factor * aug[col][j] for j in range(2 * n)]

    return [row[n:] for row in aug]


# ---------------------------------------------------------------------------
# Simple Linear Regression  (y = a + b·x)
# ---------------------------------------------------------------------------

class SimpleLinearRegression:
    """Single-feature OLS linear regression.

    Usage:
        model = SimpleLinearRegression()
        model.fit(x_values, y_values)
        prediction = model.predict(new_x)
    """

    def __init__(self):
        self.slope: float = 0.0
        self.intercept: float = 0.0
        self.r_squared: float = 0.0

    def fit(self, x: List[float], y: List[float]) -> "SimpleLinearRegression":
        """Train the model with feature vector *x* and target *y*."""
        n = len(x)
        if n < 2:
            return self

        x_mean = sum(x) / n
        y_mean = sum(y) / n

        numerator = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, y))
        denominator = sum((xi - x_mean) ** 2 for xi in x)

        if denominator == 0:
            self.slope = 0.0
        else:
            self.slope = numerator / denominator
        self.intercept = y_mean - self.slope * x_mean

        # R² goodness of fit
        ss_res = sum((yi - self.predict(xi)) ** 2 for xi, yi in zip(x, y))
        ss_tot = sum((yi - y_mean) ** 2 for yi in y)
        self.r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0.0

        return self

    def predict(self, x: float) -> float:
        """Predict target for a single feature value."""
        return self.intercept + self.slope * x


# ---------------------------------------------------------------------------
# Multiple Linear Regression  (y = Xβ)
# ---------------------------------------------------------------------------

class MultipleLinearRegression:
    """Multi-feature OLS linear regression using the Normal Equation:
        β = (XᵀX)⁻¹ · Xᵀy

    X is augmented with a leading column of 1s for the intercept.

    Usage:
        model = MultipleLinearRegression()
        model.fit(feature_matrix, target_vector)
        prediction = model.predict(feature_vector)
    """

    def __init__(self):
        self.coefficients: List[float] = []
        self.r_squared: float = 0.0

    def fit(
        self,
        X: List[List[float]],
        y: List[float],
    ) -> "MultipleLinearRegression":
        """Train the model.

        Args:
            X: Feature matrix — each inner list is one observation's features.
            y: Target vector.
        """
        n = len(X)
        if n < 2:
            return self

        # Augment X with intercept column
        X_aug = [[1.0] + row for row in X]

        X_T = _transpose(X_aug)
        XtX = _mat_mul(X_T, X_aug)
        Xty = _mat_vec_mul(X_T, y)

        try:
            XtX_inv = _invert_matrix(XtX)
            self.coefficients = _mat_vec_mul(XtX_inv, Xty)
            
            # R²
            y_mean = sum(y) / n
            y_pred = [self.predict(row) for row in X]
            ss_res = sum((yi - yp) ** 2 for yi, yp in zip(y, y_pred))
            ss_tot = sum((yi - y_mean) ** 2 for yi in y)
            self.r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0.0

        except ValueError:
            # Singular matrix — return zero coefficients
            self.coefficients = [0.0] * (len(X[0]) + 1)
            self.r_squared = 0.0

        return self

    def predict(self, features: List[float]) -> float:
        """Predict target for a single feature vector (without intercept column)."""
        augmented = [1.0] + features
        return _dot(self.coefficients, augmented)


# ---------------------------------------------------------------------------
# Default feature extraction from Property
# ---------------------------------------------------------------------------

# Columns used when building the default regression model.
DEFAULT_FEATURES = ["surface_m2", "rooms", "floor", "year_built", "distance_to_center_km"]


def _extract_features(prop: Property, feature_names: Optional[List[str]] = None) -> List[float]:
    """Pull numeric feature values from a Property dataclass."""
    names = feature_names or DEFAULT_FEATURES
    return [float(getattr(prop, name, 0)) for name in names]


# ---------------------------------------------------------------------------
# Convenience function
# ---------------------------------------------------------------------------

def predict_property_value(
    property_data: Dict,
    properties: List[Property],
    feature_names: Optional[List[str]] = None,
) -> Dict:
    """Train a simple regression model on *properties* and predict for *property_data*.

    Args:
        property_data: Dict with at least the keys in *feature_names*.
        properties:    Training set of Property objects.
        feature_names: Features to use (defaults to 'surface_m2' for robustness).

    Returns:
        Dict with keys: predicted_price, r_squared, features_used.
    """
    # Use just surface to ensure robust prediction on small datasets
    X = [p.surface_m2 for p in properties]
    y = [p.price for p in properties]

    model = SimpleLinearRegression()
    model.fit(X, y)

    input_surf = float(property_data.get("surface_m2", 0))
    predicted = model.predict(input_surf)

    return {
        "predicted_price": round(max(predicted, 0), 2),
        "r_squared": round(model.r_squared, 4),
        "features_used": ["surface_m2"],
        "coefficients": {
            "intercept": round(model.intercept, 4),
            "surface_m2": round(model.slope, 4)
        },
    }
