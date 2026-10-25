// Génération des polygones de « zones de correspondance » (Gold / Argent).
// Ce sont des zones calculées par l'application à partir de l'adéquation des
// annonces — PAS des isochrones de temps de trajet.

export type LngLat = [number, number]

/** Enveloppe convexe (monotone chain) de points [lng, lat]. */
function convexHull(points: LngLat[]): LngLat[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length <= 2) return pts
  const cross = (o: LngLat, a: LngLat, b: LngLat) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: LngLat[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: LngLat[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

/** Centroïde simple. */
function centroid(points: LngLat[]): LngLat {
  const s = points.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0] as LngLat)
  return [s[0] / points.length, s[1] / points.length]
}

/** Dilate un anneau depuis son centroïde et arrondit les angles. */
function buffer(ring: LngLat[], factor: number): LngLat[] {
  const c = centroid(ring)
  return ring.map((p) => [c[0] + (p[0] - c[0]) * factor, c[1] + (p[1] - c[1]) * factor] as LngLat)
}

/** Petit cercle géodésique approché (anneau fermé [lng,lat]). */
export function circle(center: LngLat, radiusKm: number, steps = 32): LngLat[] {
  const ring: LngLat[] = []
  const latR = radiusKm / 111
  const lngR = radiusKm / (111 * Math.cos((center[1] * Math.PI) / 180))
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    ring.push([center[0] + Math.cos(a) * lngR, center[1] + Math.sin(a) * latR])
  }
  return ring
}

/**
 * Polygone translucide englobant un groupe d'annonces d'un même niveau.
 * Renvoie un anneau fermé [lng, lat] prêt pour un GeoJSON Polygon.
 */
export function zoneRing(points: LngLat[]): LngLat[] {
  if (points.length === 0) return []
  if (points.length === 1) return circle(points[0], 0.9)
  if (points.length === 2) {
    const c = centroid(points)
    return circle(c, Math.max(0.7, dist(points[0], points[1]) * 55))
  }
  const hull = convexHull(points)
  const buffered = buffer(hull, 1.35)
  return smooth(buffered)
}

function dist(a: LngLat, b: LngLat): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Chaikin : adoucit un polygone pour un rendu organique. */
function smooth(ring: LngLat[], iterations = 2): LngLat[] {
  let r = ring
  for (let it = 0; it < iterations; it++) {
    const out: LngLat[] = []
    for (let i = 0; i < r.length; i++) {
      const a = r[i]
      const b = r[(i + 1) % r.length]
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    r = out
  }
  return r
}

export function closeRing(ring: LngLat[]): LngLat[] {
  if (ring.length === 0) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) return [...ring, first]
  return ring
}
