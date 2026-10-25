// Fixture navigateur pour vérifier la reprise d'un projet déjà renseigné.
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import ProfileChoice from '../src/components/profile/ProfileChoice'
import { StoreProvider, useStore } from '../src/store/store'

function Fixture() {
  const { state, dispatch, send } = useStore()
  useEffect(() => {
    dispatch({ type: 'CHOOSE', accountType: 'particulier' })
    dispatch({ type: 'TOGGLE_FAV', id: 'nte1', by: 'me' })
    send('Un T3 à Nantes budget maximum 1200 €', 'me')
  }, [])
  return <><ProfileChoice /><output data-testid="project-snapshot" style={{ display: 'none' }}>{JSON.stringify(state)}</output></>
}

document.getElementById('root')!.style.display = 'none'
const target = document.createElement('div')
document.body.append(target)
createRoot(target).render(<StoreProvider><Fixture /></StoreProvider>)
