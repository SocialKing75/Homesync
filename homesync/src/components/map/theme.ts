import type { Map as MlMap, LayerSpecification } from 'maplibre-gl'

// Retravaille le style OpenFreeMap « Liberty » vers l'identité HomeSync :
// fond crème, eau bleu doux, bâtiments discrets, routes peu contrastées,
// libellés lisibles. On ajuste les couches existantes au chargement.

const CREME = '#FFF5E1'
const CREME_LAND = '#f8f6ef'
const WATER = '#CFE0E6'
const GREEN = '#E7ECDC'
const ROAD = '#EADFCF'
const ROAD_MAJOR = '#E4D4BE'
const BUILDING = '#edeae3'
const LABEL = '#2D4263'
const LABEL_HALO = '#FFFFFF'

function has(id: string, needles: string[]) {
  const l = id.toLowerCase()
  return needles.some((n) => l.includes(n))
}

export function applyHomeSyncTheme(map: MlMap) {
  const style = map.getStyle()
  if (!style?.layers) return

  for (const layer of style.layers as LayerSpecification[]) {
    const id = layer.id
    try {
      if (layer.type === 'background') {
        map.setPaintProperty(id, 'background-color', CREME)
        continue
      }
      if (layer.type === 'fill') {
        if (has(id, ['water', 'ocean', 'sea', 'river', 'lake'])) {
          map.setPaintProperty(id, 'fill-color', WATER)
        } else if (has(id, ['building'])) {
          map.setPaintProperty(id, 'fill-color', BUILDING)
          map.setPaintProperty(id, 'fill-opacity', 0.55)
        } else if (has(id, ['wood', 'forest', 'park', 'grass', 'green', 'golf', 'pitch', 'cemetery'])) {
          map.setPaintProperty(id, 'fill-color', GREEN)
        } else if (has(id, ['landcover', 'landuse', 'residential', 'sand', 'glacier'])) {
          map.setPaintProperty(id, 'fill-color', CREME_LAND)
        } else {
          map.setPaintProperty(id, 'fill-color', CREME_LAND)
        }
        continue
      }
      if (layer.type === 'fill-extrusion') {
        map.setPaintProperty(id, 'fill-extrusion-color', BUILDING)
        map.setPaintProperty(id, 'fill-extrusion-opacity', 0.4)
        continue
      }
      if (layer.type === 'line') {
        if (has(id, ['water', 'river', 'waterway'])) {
          map.setPaintProperty(id, 'line-color', WATER)
        } else if (has(id, ['motorway', 'trunk', 'primary'])) {
          map.setPaintProperty(id, 'line-color', ROAD_MAJOR)
        } else if (has(id, ['road', 'street', 'highway', 'transportation', 'bridge', 'tunnel', 'rail'])) {
          map.setPaintProperty(id, 'line-color', ROAD)
        } else if (has(id, ['boundary', 'admin'])) {
          map.setPaintProperty(id, 'line-color', '#D8C7B4')
        } else {
          map.setPaintProperty(id, 'line-color', ROAD)
        }
        continue
      }
      if (layer.type === 'symbol') {
        // Libellés lisibles mais doux.
        if (map.getLayoutProperty(id, 'text-field') !== undefined) {
          map.setPaintProperty(id, 'text-color', LABEL)
          map.setPaintProperty(id, 'text-halo-color', LABEL_HALO)
          map.setPaintProperty(id, 'text-halo-width', 1.4)
        }
        continue
      }
    } catch {
      // Couche au schéma inattendu : on l'ignore sans bloquer le rendu.
    }
  }
}
