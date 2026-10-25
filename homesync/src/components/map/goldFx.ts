// Réglages centralisés de l'effet « zones Gold » (poudre d'or lumineuse).
// Un seul endroit pour ajuster densité, vitesse, couleurs, opacité et halo.
// Les zones Argent restent volontairement sobres : elles n'utilisent aucun de
// ces réglages (voir MapView — couches `zones-*`).

export const GOLD_FX = {
  // Palette or.
  colors: {
    deep: '#B88A24', // or profond — remplissage
    luminous: '#E7BE59', // or lumineux — contour + halo
    champagne: '#FFF0BC', // champagne — particules
  },

  // Remplissage doré translucide (laisse les rues lisibles).
  fill: {
    opacity: 0.2,
  },

  // Contour fin couleur or.
  line: {
    width: 1.3,
    opacity: 0.9,
  },

  // Halo doux autour de la zone. Seul le halo peut dépasser les contours.
  halo: {
    width: 11, // largeur du trait flou (px)
    blur: 9, // flou du trait (px)
    opacity: 0.32, // intensité au repos
    opacitySelected: 0.5, // la sélection renforce légèrement le halo
  },

  // Fines particules champagne à l'intérieur des polygones.
  particles: {
    densityPerKm2: 14, // nombre de particules par km² de zone Gold
    mobileFactor: 0.5, // densité réduite sur mobile
    maxTotal: 1500, // plafond de sécurité (toutes zones confondues)
    sizePx: 2.3, // taille de base d'une particule (px CSS)
    sizeJitter: 1.1, // variation aléatoire de taille (±)
    baseAlpha: 0.9, // opacité maximale d'une particule
    minTwinkle: 0.15, // plancher du scintillement (jamais totalement éteint)
    speed: 0.7, // vitesse de scintillement (rad/s)
    speedJitter: 0.5, // désynchronisation (variation ± de vitesse)
    fps: 30, // cadence d'animation (throttling du repaint)
  },
}

export type GoldFxConfig = typeof GOLD_FX

/** #rrggbb -> [r, g, b] normalisé 0..1. */
export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
