# =============================================================================
# backend/analysis/knn.py — k-Nearest Neighbors Valuation Engine
# =============================================================================
import math
from typing import List, Dict
from backend.models.data_models import Property

def normalize(val: float, min_val: float, max_val: float) -> float:
    """Min-max normalization to scale values between 0 and 1."""
    if max_val == min_val:
        return 0.0
    return (val - min_val) / (max_val - min_val)

def find_knn_opportunities(properties: List[Property], k: int = 5) -> List[Dict]:
    """
    Finds the most undervalued properties by comparing them to their k-nearest neighbors.
    Similarity is based on surface area, geographic location (distance to center), and property type.
    """
    if not properties or len(properties) <= k:
        return []

    # 1. Quick stats for normalization
    surfaces = [p.surface_m2 for p in properties if p.surface_m2 > 0]
    distances = [p.distance_to_center_km for p in properties]
    
    if not surfaces: 
        return []

    min_surf, max_surf = min(surfaces), max(surfaces)
    min_dist, max_dist = min(distances), max(distances)

    results = []

    # 2. Compare every property against every other property
    for target in properties:
        # We only evaluate properties that have valid data
        if target.surface_m2 <= 0 or target.price_per_m2 <= 0:
            continue

        neighbors = []
        for candidate in properties:
            if candidate.id == target.id:
                continue
            
            # Penalize heavily if the property type doesn't match
            type_penalty = 0.0 if target.property_type == candidate.property_type else 1.0
            
            # Calculate normalized Euclidean distance
            norm_surf_diff = normalize(target.surface_m2, min_surf, max_surf) - normalize(candidate.surface_m2, min_surf, max_surf)
            norm_dist_diff = normalize(target.distance_to_center_km, min_dist, max_dist) - normalize(candidate.distance_to_center_km, min_dist, max_dist)
            
            # Weighted distance: Neighborhood matters most, then type, then surface
            distance = math.sqrt(
                (0.5 * norm_dist_diff) ** 2 + 
                (0.3 * norm_surf_diff) ** 2 + 
                (1.0 * type_penalty) ** 2
            )
            
            neighbors.append((distance, candidate))
        
        # Sort by closest distance
        neighbors.sort(key=lambda x: x[0])
        top_k = neighbors[:k]
        
        # 3. Calculate valuation delta
        # Average price/m2 of the 5 closest similar properties
        avg_neighbor_pm2 = sum(c.price_per_m2 for _, c in top_k) / len(top_k)
        
        # If the target's pm2 is significantly lower than its neighbors, it's undervalued
        underval_pct = ((avg_neighbor_pm2 - target.price_per_m2) / avg_neighbor_pm2) * 100
        
        if underval_pct > 0:
            results.append({
                "property": target,
                "undervaluation_pct": underval_pct,
                "avg_neighbor_pm2": avg_neighbor_pm2,
                "neighbors": [c for _, c in top_k]
            })

    # Sort by highest undervaluation descending
    results.sort(key=lambda x: x["undervaluation_pct"], reverse=True)
    return results
