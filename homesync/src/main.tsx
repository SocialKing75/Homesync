import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App'
import { StoreProvider } from './store/store'

// NB : pas de <StrictMode> ici. Le double montage de StrictMode recrée la carte
// MapLibre (création → suppression → recréation) et corrompt l'initialisation
// impérative des sources GeoJSON. L'intégration carte est pilotée manuellement.
createRoot(document.getElementById('root')!).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
)
