import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike, Map as MlMap, Marker, Popup } from 'maplibre-gl'
import { useStore } from '../../store/store'
import { applyHomeSyncTheme } from './theme'
import { CITIES, FRANCE_CENTER, FRANCE_ZOOM } from '../../data/cities'
import { getListings, getListing } from '../../services'
import type { Listing, MatchTier } from '../../types'
import { circle, closeRing, type LngLat } from '../../lib/geo'
import { totalCost } from '../../lib/matching'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const euro = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR')} €`)

function tierClass(t: MatchTier | undefined): string {
  if (t === 'gold') return 'gold'
  if (t === 'silver') return 'silver'
  return ''
}

export default function MapView() {
  const { state, dispatch } = useStore()
  const [mapError, setMapError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const readyRef = useRef(false)
  const manualMoveAt = useRef(0)
  const collisionFrame = useRef<number | null>(null)

  const priceMarkers = useRef<Record<string, Marker>>({})
  const clusterMarkers = useRef<Record<string, Marker>>({})
  const avatarMarkers = useRef<Marker[]>([])
  const previewMarkers = useRef<Marker[]>([])
  const hoverPopup = useRef<Popup | null>(null)

  // Refs de valeurs « fraîches » pour les handlers impératifs.
  const stateRef = useRef(state)
  stateRef.current = state

  // --- Initialisation de la carte ----------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let map: MlMap
    try { map = new MlMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: [FRANCE_CENTER[1], FRANCE_CENTER[0]],
      zoom: FRANCE_ZOOM,
      attributionControl: false,
      minZoom: 0,
      bounds: [[-5.3, 41.3], [9.7, 51.2]],
      fitBoundsOptions: { padding: 35 },
      maxZoom: 18,
      dragRotate: false,
    }) } catch { setMapError(true); return }
    map.on('error', () => setMapError(true))
    map.on('idle', () => setMapError(false))
    const loadingTimeout = window.setTimeout(() => { if (!map.isStyleLoaded()) setMapError(true) }, 15000)
    map.on('dragstart', (e) => { if (e.originalEvent) manualMoveAt.current = Date.now() })
    map.on('zoomstart', (e) => { if (e.originalEvent) manualMoveAt.current = Date.now() })
    map.on('move', () => {
      if (collisionFrame.current !== null) return
      collisionFrame.current = requestAnimationFrame(() => { layoutMarkers(); collisionFrame.current = null })
    })
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)
    mapRef.current = map
    ;(window as unknown as { __hsMap?: MlMap }).__hsMap = map
    // Attributions OSM / OpenFreeMap conservées (obligatoire).
    map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    hoverPopup.current = new Popup({ closeButton: false, closeOnClick: false, offset: 18, className: 'hs-hover' })

    const setupSourcesAndLayers = () => {
      if (map.getSource('zones')) return // déjà initialisé
      // Source des zones de correspondance (calculées par l'application).
      map.addSource('zones', { type: 'geojson', data: emptyFC() })
      map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: 'zones',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': ['match', ['get', 'tier'], 'gold', '#B88A24', 'silver', '#8193A6', '#B88A24'],
          'fill-opacity': 0.22,
        },
      })
      map.addLayer({
        id: 'zones-line',
        type: 'line',
        source: 'zones',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': ['match', ['get', 'tier'], 'gold', '#8f6a16', 'silver', '#5f7085', '#8f6a16'],
          'line-width': 1.8,
          'line-dasharray': [2, 1.4],
          'line-opacity': 0.75,
        },
      })
      map.addLayer({
        id: 'zones-label',
        type: 'symbol',
        source: 'zones',
        filter: ['==', ['geometry-type'], 'Point'],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-font': ['Noto Sans Regular'],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': ['match', ['get', 'tier'], 'gold', '#8f6a16', 'silver', '#5f7085', '#8f6a16'],
          'text-halo-color': '#FFF5E1',
          'text-halo-width': 2,
        },
      })

      // Source des annonces (clustering natif MapLibre).
      map.addSource('listings', {
        type: 'geojson',
        data: emptyFC(),
        cluster: true,
        clusterRadius: 52,
        clusterMaxZoom: 11,
      })
      // Couche invisible : force le chargement des tuiles pour querySourceFeatures.
      map.addLayer({
        id: 'listings-hit',
        type: 'circle',
        source: 'listings',
        paint: { 'circle-radius': 1, 'circle-opacity': 0 },
      })

      readyRef.current = true
      // 'idle' (fin de rendu) + 'moveend' : léger, contrairement à 'render' (chaque frame).
      map.on('idle', syncMarkers)
      map.on('moveend', syncMarkers)
      map.on('sourcedata', (e) => { if (e.sourceId === 'listings' && e.isSourceLoaded) syncMarkers() })
      map.on('click', 'zones-fill', (e) => {
        const tier = e.features?.[0]?.properties?.tier
        const nearest = visibleListings().filter(l => stateRef.current.results.evaluations[l.id]?.tier === tier).sort((a, b) => Math.hypot(a.lng - e.lngLat.lng, a.lat - e.lngLat.lat) - Math.hypot(b.lng - e.lngLat.lng, b.lat - e.lngLat.lat))[0]
        if (nearest) dispatch({ type: 'SELECT', id: nearest.id })
      })
      refreshData()
      refreshZones()
      syncMarkers()
      syncAvatars()
    }

    map.on('load', () => {
      applyHomeSyncTheme(map)
      // On diffère la création des sources/couches au premier 'idle' : le style
      // OpenFreeMap est alors totalement finalisé. Créer une source GeoJSON et
      // appeler setData pendant 'load' corrompt son cache de tuiles.
      map.once('idle', setupSourcesAndLayers)
    })

    return () => {
      observer.disconnect()
      clearTimeout(loadingTimeout)
      if (collisionFrame.current !== null) cancelAnimationFrame(collisionFrame.current)
      Object.values(priceMarkers.current).forEach((m) => m.remove())
      Object.values(clusterMarkers.current).forEach((m) => m.remove())
      priceMarkers.current = {}
      clusterMarkers.current = {}
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Données des annonces affichées ------------------------------------
  function visibleListings(): Listing[] {
    const s = stateRef.current
    return s.criteria.cities.length ? s.results.included : getListings()
  }

  function refreshData() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const src = map.getSource('listings') as GeoJSONSource | undefined
    if (!src) return
    const feats = visibleListings().map((l) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
      properties: { id: l.id },
    }))
    src.setData({ type: 'FeatureCollection', features: feats })
    // Les marqueurs seront reconstruits : on repart propre.
    Object.values(priceMarkers.current).forEach((m) => m.remove())
    priceMarkers.current = {}
  }

  function refreshZones() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const s = stateRef.current
    const src = map.getSource('zones') as GeoJSONSource | undefined
    if (!src) return
    if (!s.criteria.cities.length) {
      src.setData(emptyFC())
      return
    }
    const features: GeoJSON.Feature[] = []
    // Zones = regroupement d'auréoles autour de chaque annonce d'un même niveau.
    // Ce sont des zones de correspondance calculées, pas des temps de trajet.
    const build = (tier: 'gold' | 'silver', listings: Listing[], label: string) => {
      if (listings.length === 0) return
      const byCity: Record<string, LngLat[]> = {}
      for (const l of listings) (byCity[l.city] ??= []).push([l.lng, l.lat])
      for (const pts of Object.values(byCity)) {
        // Une auréole translucide autour de chaque annonce (elles se fondent).
        for (const p of pts) {
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [closeRing(circle(p, 1.15))] },
            properties: { tier },
          })
        }
        // Un seul libellé par groupe, au centre de gravité.
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length
        const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [cx, cy] },
          properties: { tier, label },
        })
      }
    }
    build('silver', s.results.silver, 'Compromis possible')
    build('gold', s.results.gold, 'Meilleur accord')
    src.setData({ type: 'FeatureCollection', features })
  }

  // --- Synchronisation des marqueurs HTML --------------------------------
  function syncMarkers() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const s = stateRef.current
    // Au-delà du zoom de clustering, les repères proviennent directement des
    // résultats : ils ne dépendent pas de l'arrivée des tuiles du fond de carte.
    const feats = map.getZoom() >= 12
      ? visibleListings().map((l) => ({ geometry: { type: 'Point', coordinates: [l.lng, l.lat] }, properties: { id: l.id } }))
      : map.querySourceFeatures('listings')
    const seenClusters = new Set<string>()
    const seenPins = new Set<string>()

    for (const f of feats) {
      if (f.geometry.type !== 'Point') continue
      const coords = f.geometry.coordinates as [number, number]
      const props = f.properties as Record<string, unknown>

      if (props.cluster) {
        const cid = 'c' + props.cluster_id
        if (seenClusters.has(cid)) continue
        seenClusters.add(cid)
        if (!clusterMarkers.current[cid]) {
          const count = Number(props.point_count)
          const el = clusterEl(count)
          el.addEventListener('click', () => {
            const src = map.getSource('listings') as GeoJSONSource
            src.getClusterExpansionZoom(Number(props.cluster_id)).then((z) => {
              map.easeTo({ center: coords, zoom: z })
            })
          })
          clusterMarkers.current[cid] = new Marker({ element: el }).setLngLat(coords).addTo(map)
          el.setAttribute('aria-label', `Explorer ${count} annonces`)
        }
      } else {
        const id = String(props.id)
        if (seenPins.has(id)) continue
        seenPins.add(id)
        const listing = getListing(id)
        if (!listing) continue
        const tier = s.results.evaluations[id]?.tier
        const active = s.selectedId === id
        const fav = (s.favorites[id]?.length ?? 0) > 0
        if (!priceMarkers.current[id]) {
          const el = priceEl(listing, tier, active, fav)
          attachPinHandlers(el, listing, map)
          priceMarkers.current[id] = new Marker({ element: el, anchor: 'bottom' }).setLngLat(coords).addTo(map)
        } else {
          const el = priceMarkers.current[id].getElement().querySelector('.pin') as HTMLElement
          el.className = `pin ${tierClass(tier)} ${active ? 'active' : ''}`.trim()
          const heart = priceMarkers.current[id].getElement().querySelector('.fav') as HTMLElement | null
          if (heart) heart.style.display = fav ? 'flex' : 'none'
        }
      }
    }

    // Nettoyage des marqueurs disparus.
    for (const cid of Object.keys(clusterMarkers.current))
      if (!seenClusters.has(cid)) {
        clusterMarkers.current[cid].remove()
        delete clusterMarkers.current[cid]
      }
    for (const id of Object.keys(priceMarkers.current))
      if (!seenPins.has(id)) {
        priceMarkers.current[id].remove()
        delete priceMarkers.current[id]
      }
    layoutMarkers()
  }

  function layoutMarkers() {
    const map = mapRef.current
    if (!map) return
    const s = stateRef.current
    const boxes: { left: number; right: number; top: number; bottom: number }[] = []
    const ids = Object.keys(priceMarkers.current).sort((a, b) => Number(b === s.selectedId) - Number(a === s.selectedId) || Number(!!s.favorites[b]?.length) - Number(!!s.favorites[a]?.length) || a.localeCompare(b))
    for (const id of ids) {
      const marker = priceMarkers.current[id]
      const el = marker.getElement()
      const point = map.project(marker.getLngLat())
      const width = Math.max(76, el.offsetWidth) + 12
      const box = { left: point.x - width / 2, right: point.x + width / 2, top: point.y - 44, bottom: point.y + 8 }
      const hidden = id !== s.selectedId && boxes.some(b => box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top)
      el.dataset.hidden = String(hidden)
      el.dataset.selected = String(id === s.selectedId)
      el.setAttribute('aria-hidden', String(hidden))
      el.setAttribute('aria-pressed', String(id === s.selectedId))
      el.setAttribute('aria-label', `Voir ${getListing(id)?.title ?? 'le logement'}`)
      el.tabIndex = hidden ? -1 : 0
      if (!hidden) boxes.push(box)
    }
  }

  function attachPinHandlers(el: HTMLElement, listing: Listing, map: MlMap) {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      dispatch({ type: 'SELECT', id: listing.id })
    })
    el.addEventListener('mouseenter', () => {
      hoverPopup.current
        ?.setLngLat([listing.lng, listing.lat])
        .setHTML(hoverHtml(listing))
        .addTo(map)
    })
    el.addEventListener('mouseleave', () => hoverPopup.current?.remove())
  }

  // --- Avatars des participants ------------------------------------------
  function syncAvatars() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    avatarMarkers.current.forEach((m) => m.remove())
    avatarMarkers.current = []
    for (const p of stateRef.current.participants) {
      if (!p.place) continue
      const el = document.createElement('div')
      el.className = 'hs-avatar-pin'
      const avatar = document.createElement('div')
      avatar.className = 'ava'; avatar.style.background = p.color; avatar.textContent = p.initials
      const label = document.createElement('div')
      label.className = 'tag'; label.textContent = p.place.label
      el.append(avatar, label)
      avatarMarkers.current.push(
        new Marker({ element: el, anchor: 'bottom' }).setLngLat([p.place.lng, p.place.lat]).addTo(map),
      )
    }
  }

  // --- Aperçu « Et si… ? » : repères temporaires en pointillés -----------
  function syncPreview() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    previewMarkers.current.forEach((m) => m.remove())
    previewMarkers.current = []
    const wi = stateRef.current.whatIf
    if (!wi) return
    for (const id of wi.extraListingIds) {
      const l = getListing(id)
      if (!l) continue
      const el = document.createElement('div')
      el.className = 'hs-price-pin'
      el.innerHTML = `<div class="pin preview">+ ${euro(totalCost(l))}</div>`
      previewMarkers.current.push(
        new Marker({ element: el, anchor: 'bottom' }).setLngLat([l.lng, l.lat]).addTo(map),
      )
    }
  }

  // --- Réactions aux changements de l'état --------------------------------
  useEffect(() => {
    refreshData()
    refreshZones()
    if (mapRef.current && readyRef.current) mapRef.current.triggerRepaint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.results, state.criteria.cities.join()])

  useEffect(() => {
    syncAvatars()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.participants])

  useEffect(() => {
    syncPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.whatIf])

  useEffect(() => { syncMarkers(); layoutMarkers() }, [state.selectedId, state.favorites])

  // --- Commandes de carte venues du chat ----------------------------------
  useEffect(() => {
    const map = mapRef.current
    const cmd = state.mapCmd
    if (!map || !cmd) return
    if (cmd.kind === 'view') {
      if (cmd.zoom === FRANCE_ZOOM && cmd.center[0] === FRANCE_CENTER[1]) map.fitBounds([[-5.3, 41.3], [9.7, 51.2]], { padding: 35, duration: 1000 })
      else map.flyTo({ center: cmd.center, zoom: cmd.zoom, duration: 1200 })
    } else if (cmd.kind === 'cities') {
      if (cmd.requestedAt && manualMoveAt.current > cmd.requestedAt) return
      const coords = cmd.cities
        .map((name) => CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase()))
        .filter(Boolean) as (typeof CITIES)[number][]
      if (coords.length === 1) {
        map.flyTo({ center: [coords[0].lng, coords[0].lat], zoom: coords[0].zoom, duration: 1300 })
      } else if (coords.length > 1) {
        const lngs = coords.map((c) => c.lng)
        const lats = coords.map((c) => c.lat)
        const bounds: LngLatBoundsLike = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ]
        map.fitBounds(bounds, { padding: 90, duration: 1300, maxZoom: 11 })
      }
    } else if (cmd.kind === 'highlight') {
      const l = getListing(cmd.listingId)
      if (l) map.flyTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 13), duration: 900 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mapCmd])

  // Recadre la carte quand on agrandit / réduit le panneau.
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 260)
    return () => clearTimeout(t)
  }, [state.expandedMap, state.mobileTab])

  return <><div ref={containerRef} className="h-full w-full" aria-label="Carte de France des logements" />{mapError && <div role="status" className="absolute bottom-16 left-3 z-20 max-w-xs rounded-xl bg-white p-3 text-xs text-aubergine shadow-lg">Le fond de carte rencontre une erreur réseau. Vérifiez votre connexion ; le chat et les fiches restent disponibles.</div>}</>
}

// ---------------------------------------------------------------------------
// Fabriques d'éléments HTML pour les marqueurs
// ---------------------------------------------------------------------------
function emptyFC(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function clusterEl(count: number): HTMLElement {
  const size = count < 10 ? 50 : count < 30 ? 56 : 62
  const el = document.createElement('div')
  el.className = 'hs-cluster'
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', `Explorer ${count} annonces`)
  el.tabIndex = 0
  el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click() } }
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  el.innerHTML = `<div class="bubble"><span class="n">${count}</span><span class="lbl">annonces</span></div>`
  return el
}

function priceEl(listing: Listing, tier: MatchTier | undefined, active: boolean, fav: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = 'hs-price-pin'
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', `Voir ${listing.title}`)
  el.tabIndex = 0
  el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click() } }
  const total = totalCost(listing)
  const label = total !== null ? euro(total) : `${euro(listing.rent)}+`
  el.innerHTML = `<div class="pin ${tierClass(tier)} ${active ? 'active' : ''}">${label}</div><div class="fav" style="display:${
    fav ? 'flex' : 'none'
  }">♥</div>`
  return el
}

function hoverHtml(l: Listing): string {
  const total = totalCost(l)
  return `
    <div>
      <div style="height:104px;background:url('${l.photos[0]}') center/cover;background-color:#edf0f2"></div>
      <div style="padding:8px 10px">
        <h3>${l.title}</h3>
        <p>${l.surface} m² · ${l.rooms} pièces · ${l.city}</p>
        <strong>${
          total !== null ? euro(total) + ' CC' : euro(l.rent) + ' + charges'
        }</strong>
      </div>
    </div>`
}


