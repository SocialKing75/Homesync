// Couche personnalisée MapLibre (WebGL) pour la « poudre d'or » des zones Gold.
//
// Principes :
// - Rendu dans le contexte GL de la carte -> suit nativement zoom, déplacement,
//   rotation et inclinaison, et reste SOUS les marqueurs HTML (les repères de
//   prix restent visibles et cliquables).
// - Aucun élément HTML par particule ; aucun rendu React par frame.
// - Les positions sont échantillonnées une fois (en lng/lat) à l'intérieur des
//   vrais polygones Gold, trous respectés (test pair/impair sur tous les anneaux).
// - Scintillement lent et désynchronisé (phase + vitesse propres à chaque
//   particule), calculé dans le shader.
// - Animation suspendue quand l'onglet est masqué ; rendu statique si
//   `prefers-reduced-motion`. Repli statique si WebGL échoue (la couche se
//   désactive silencieusement, les couches de remplissage/contour/halo restent).

import maplibregl, { type CustomLayerInterface, type Map as MlMap } from 'maplibre-gl'
import { GOLD_FX, hexToRgb01 } from './goldFx'

type Ring = [number, number][]
type GoldPolygon = Ring[] // [anneau extérieur, trou1, trou2, ...]

const FLOATS_PER_PARTICLE = 5 // x, y (mercator), phase, speedMul, sizeRand
const VERTEX_SRC = `
  precision mediump float;
  uniform mat4 u_matrix;
  uniform float u_time;      // secondes
  uniform float u_dpr;
  uniform float u_size;      // px CSS
  uniform float u_sizeJitter;
  attribute vec2 a_pos;      // coord mercator
  attribute vec3 a_meta;     // phase, speedMul, sizeRand
  varying float v_tw;        // facteur de scintillement [0..1]
  void main() {
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
    float phase = a_meta.x;
    float speedMul = a_meta.y;
    float sizeRand = a_meta.z;
    // Scintillement lent, désynchronisé (sinusoïde douce).
    v_tw = 0.5 + 0.5 * sin(u_time * speedMul + phase);
    float size = u_size + sizeRand * u_sizeJitter;
    // Légère respiration de taille, très subtile.
    size *= 0.9 + 0.1 * v_tw;
    gl_PointSize = size * u_dpr;
  }
`
const FRAGMENT_SRC = `
  precision mediump float;
  uniform vec3 u_champagne;
  uniform vec3 u_luminous;
  uniform float u_baseAlpha;
  uniform float u_minTwinkle;
  uniform float u_intensity;  // 0..1, atténuation globale
  varying float v_tw;
  void main() {
    // Point rond et doux : alpha décroît du centre vers le bord.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    float soft = smoothstep(1.0, 0.0, r);
    soft *= soft; // bord plus doux
    float tw = mix(u_minTwinkle, 1.0, v_tw);
    float a = u_baseAlpha * soft * tw * u_intensity;
    // Variation de teinte champagne -> or lumineux selon la particule.
    vec3 color = mix(u_champagne, u_luminous, clamp(v_tw * 0.4, 0.0, 0.4));
    // Alpha prémultiplié (blendFunc par défaut : ONE, ONE_MINUS_SRC_ALPHA).
    gl_FragColor = vec4(color * a, a);
  }
`

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh)
    return null
  }
  return sh
}

/** Test pair/impair sur tous les anneaux -> intérieur du polygone, trous exclus. */
function pointInPolygon(rings: GoldPolygon, lng: number, lat: number): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside
      }
    }
  }
  return inside
}

/** Aire signée (shoelace) d'un anneau, en degrés². */
function ringArea(ring: Ring): number {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(a) / 2
}

/** Aire approximative d'un polygone (anneau extérieur moins trous), en km². */
function polygonAreaKm2(rings: GoldPolygon): number {
  if (rings.length === 0 || rings[0].length < 3) return 0
  let deg2 = ringArea(rings[0])
  for (let k = 1; k < rings.length; k++) deg2 -= ringArea(rings[k])
  const latMean = rings[0].reduce((s, p) => s + p[1], 0) / rings[0].length
  const kmPerDegLat = 111
  const kmPerDegLng = 111 * Math.cos((latMean * Math.PI) / 180)
  return Math.max(0, deg2) * kmPerDegLat * kmPerDegLng
}

export class GoldDustLayer implements CustomLayerInterface {
  id: string
  type = 'custom' as const
  renderingMode = '2d' as const

  private map: MlMap | null = null
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private attribs: Record<string, number> = {}

  private data = new Float32Array(0)
  private count = 0
  private pending: GoldPolygon[] | null = null

  private raf = 0
  private lastRepaint = 0
  private startTime = performance.now()

  private animated = true // false si prefers-reduced-motion
  private pageVisible = !document.hidden
  private destroyed = false

  // Densité adaptée au support (mobile = moins dense).
  private mobile = false

  private onVisibility = () => {
    this.pageVisible = !document.hidden
    if (this.pageVisible) this.ensureLoop()
    else this.stopLoop()
  }
  private motionMql: MediaQueryList | null = null
  private onMotionChange = (e: MediaQueryListEvent | MediaQueryList) => {
    this.animated = !e.matches
    if (this.animated) this.ensureLoop()
    else {
      this.stopLoop()
      this.map?.triggerRepaint() // rendu statique une fois
    }
  }

  constructor(id = 'zones-gold-dust') {
    this.id = id
  }

  // --- Cycle de vie de la couche custom ----------------------------------
  onAdd(map: MlMap, gl: WebGLRenderingContext) {
    this.map = map
    this.gl = gl

    this.mobile =
      window.matchMedia('(max-width: 767px)').matches ||
      window.matchMedia('(pointer: coarse)').matches

    this.motionMql = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.animated = !this.motionMql.matches
    // Compat navigateurs : addEventListener moderne, repli addListener.
    if (this.motionMql.addEventListener) this.motionMql.addEventListener('change', this.onMotionChange)
    else this.motionMql.addListener?.(this.onMotionChange as (this: MediaQueryList, ev: MediaQueryListEvent) => void)
    document.addEventListener('visibilitychange', this.onVisibility)

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC)
    const program = gl.createProgram()
    if (!vs || !fs || !program) return // repli statique : pas de particules
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      return
    }
    this.program = program
    this.buffer = gl.createBuffer()

    const u = (n: string) => gl.getUniformLocation(program, n)
    this.uniforms = {
      u_matrix: u('u_matrix'),
      u_time: u('u_time'),
      u_dpr: u('u_dpr'),
      u_size: u('u_size'),
      u_sizeJitter: u('u_sizeJitter'),
      u_champagne: u('u_champagne'),
      u_luminous: u('u_luminous'),
      u_baseAlpha: u('u_baseAlpha'),
      u_minTwinkle: u('u_minTwinkle'),
      u_intensity: u('u_intensity'),
    }
    this.attribs = {
      a_pos: gl.getAttribLocation(program, 'a_pos'),
      a_meta: gl.getAttribLocation(program, 'a_meta'),
    }

    if (this.pending) {
      this.buildParticles(this.pending)
      this.pending = null
    }
    this.ensureLoop()
  }

  onRemove() {
    this.stopLoop()
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.motionMql) {
      if (this.motionMql.removeEventListener) this.motionMql.removeEventListener('change', this.onMotionChange)
      else this.motionMql.removeListener?.(this.onMotionChange as (this: MediaQueryList, ev: MediaQueryListEvent) => void)
    }
    const gl = this.gl
    if (gl) {
      if (this.buffer) gl.deleteBuffer(this.buffer)
      if (this.program) gl.deleteProgram(this.program)
    }
    this.buffer = null
    this.program = null
    this.gl = null
    this.map = null
    this.destroyed = true
  }

  render(gl: WebGLRenderingContext, matrix: Iterable<number>) {
    if (!this.program || this.count === 0) return
    const p = GOLD_FX.particles
    gl.useProgram(this.program)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA) // alpha prémultiplié

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    const stride = FLOATS_PER_PARTICLE * 4
    gl.enableVertexAttribArray(this.attribs.a_pos)
    gl.vertexAttribPointer(this.attribs.a_pos, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(this.attribs.a_meta)
    gl.vertexAttribPointer(this.attribs.a_meta, 3, gl.FLOAT, false, stride, 2 * 4)

    const time = this.animated ? (performance.now() - this.startTime) / 1000 : 0
    gl.uniformMatrix4fv(this.uniforms.u_matrix, false, matrix as unknown as Float32List)
    gl.uniform1f(this.uniforms.u_time, time * p.speed)
    gl.uniform1f(this.uniforms.u_dpr, Math.min(window.devicePixelRatio || 1, 2))
    gl.uniform1f(this.uniforms.u_size, p.sizePx)
    gl.uniform1f(this.uniforms.u_sizeJitter, p.sizeJitter)
    gl.uniform3fv(this.uniforms.u_champagne, hexToRgb01(GOLD_FX.colors.champagne))
    gl.uniform3fv(this.uniforms.u_luminous, hexToRgb01(GOLD_FX.colors.luminous))
    gl.uniform1f(this.uniforms.u_baseAlpha, p.baseAlpha)
    gl.uniform1f(this.uniforms.u_minTwinkle, this.animated ? p.minTwinkle : 0.7)
    gl.uniform1f(this.uniforms.u_intensity, 1)

    gl.drawArrays(gl.POINTS, 0, this.count)
  }

  // --- API publique -------------------------------------------------------
  /** Met à jour les polygones Gold (features GeoJSON Polygon). */
  setZones(features: GeoJSON.Feature[]) {
    const polys: GoldPolygon[] = []
    for (const f of features) {
      const g = f.geometry
      if (g?.type === 'Polygon') polys.push(g.coordinates as GoldPolygon)
      else if (g?.type === 'MultiPolygon') for (const poly of g.coordinates) polys.push(poly as GoldPolygon)
    }
    if (!this.program) {
      // onAdd pas encore passé : on mémorise pour construire plus tard.
      this.pending = polys
      return
    }
    this.buildParticles(polys)
    this.ensureLoop()
  }

  destroy() {
    if (this.destroyed) return
    const map = this.map
    if (map && map.getLayer?.(this.id)) {
      try {
        map.removeLayer(this.id) // déclenche onRemove -> nettoyage GL
      } catch {
        this.onRemove()
      }
    } else {
      this.onRemove()
    }
  }

  // --- Interne ------------------------------------------------------------
  private buildParticles(polys: GoldPolygon[]) {
    const gl = this.gl
    if (!gl || !this.buffer) return
    const cfg = GOLD_FX.particles
    const density = cfg.densityPerKm2 * (this.mobile ? cfg.mobileFactor : 1)

    // Nombre de particules souhaité par polygone (proportionnel à l'aire).
    const desired = polys.map((poly) => Math.round(polygonAreaKm2(poly) * density))
    let total = desired.reduce((a, b) => a + b, 0)
    const scale = total > cfg.maxTotal ? cfg.maxTotal / total : 1
    total = 0

    const arr: number[] = []
    for (let pi = 0; pi < polys.length; pi++) {
      const poly = polys[pi]
      const n = Math.floor(desired[pi] * scale)
      if (n <= 0 || poly[0]?.length < 3) continue
      // Boîte englobante de l'anneau extérieur.
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (const [x, y] of poly[0]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      let placed = 0
      let attempts = 0
      const maxAttempts = n * 12
      while (placed < n && attempts < maxAttempts) {
        attempts++
        const lng = minX + Math.random() * (maxX - minX)
        const lat = minY + Math.random() * (maxY - minY)
        if (!pointInPolygon(poly, lng, lat)) continue
        const m = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat })
        arr.push(
          m.x,
          m.y,
          Math.random() * Math.PI * 2, // phase
          1 + (Math.random() * 2 - 1) * cfg.speedJitter, // speedMul
          Math.random() * 2 - 1, // sizeRand
        )
        placed++
        total++
      }
    }

    this.data = new Float32Array(arr)
    this.count = total
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.STATIC_DRAW)
  }

  private ensureLoop() {
    if (this.destroyed || this.raf) return
    if (!this.animated || !this.pageVisible || this.count === 0) return
    const interval = 1000 / GOLD_FX.particles.fps
    const tick = (now: number) => {
      if (this.destroyed || !this.animated || !this.pageVisible || this.count === 0) {
        this.raf = 0
        return
      }
      if (now - this.lastRepaint >= interval) {
        this.lastRepaint = now
        this.map?.triggerRepaint()
      }
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  private stopLoop() {
    if (this.raf) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }
  }
}
