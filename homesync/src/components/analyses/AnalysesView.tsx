import { ArrowLeft, Home, Wallet, LayoutGrid, Heart, Info, Check, CircleHelp } from 'lucide-react'
import { useStore } from '../../store/store'
import { getListings } from '../../services'
import { summarizeListings } from '../../lib/analytics'
import { totalCost } from '../../lib/matching'
import { TierBadge } from '../common/TierBadge'

const euro = (n: number | null) => n === null ? 'À confirmer' : `${n.toLocaleString('fr-FR')} €`
export default function AnalysesView() {
  const { state, dispatch } = useStore()
  const pool = state.criteria.cities.length ? state.results.included : getListings()
  const stats = summarizeListings(pool)
  const favorites = getListings().filter(l => state.favorites[l.id]?.length)
  const companySummary = [state.criteria.units ? `${state.criteria.units} logements` : 'Nombre de logements à préciser', state.criteria.people ? `${state.criteria.people} personnes à loger` : 'Effectif à préciser', state.criteria.durationMonths ? `${state.criteria.durationMonths} mois` : 'Durée à confirmer'].join(' · ')
  const missing = [...new Set([...state.criteria.toConfirm, ...pool.flatMap(l => state.results.evaluations[l.id]?.missing ?? l.missingInfo)])]
  return <section className="analyses-view" aria-label="Analyses de votre recherche">
    <div className="analyses-inner">
      <button className="nav-link mb-5" onClick={() => dispatch({ type: 'SET_PAGE', view: 'search' })}><ArrowLeft size={17} /> Retour à la recherche</button>
      <div className="analysis-intro"><div><span className="eyebrow">COMPRENDRE VOTRE SÉLECTION</span><h1>Une vue d’ensemble, pour mieux choisir.</h1><p>{state.criteria.cities.join(' · ') || 'Catalogue de démonstration, toutes villes'}{state.accountType === 'societe' ? ` · ${companySummary}` : ' · Votre recherche commune'}</p></div><span className="demo-badge">Mode démonstration</span></div>
      <p className="scope-note"><Info size={16} /> Indicateurs calculés uniquement sur {pool.length} annonces fictives chargées{state.criteria.cities.length ? ' correspondant aux critères actuels' : ''}. Ce ne sont pas des statistiques du marché français.</p>
      <div className="metric-grid">
        <Metric icon={<Home size={20} />} label={state.criteria.cities.length ? 'Annonces correspondantes' : 'Annonces du catalogue'} value={String(stats.count)} note={state.criteria.cities.length ? 'Après application des exigences' : 'Exprimez vos critères dans le chat'} />
        <Metric icon={<Wallet size={20} />} label="Loyers charges comprises" value={stats.min === null ? 'Données indisponibles' : `${euro(stats.min)} – ${euro(stats.max)}`} note={`${stats.knownPriceCount}/${stats.count} totaux connus · par mois et par logement`} />
        <Metric icon={<Heart size={20} />} label="Favoris du projet" value={String(favorites.length)} note="Tous les favoris du projet, même hors recherche" />
      </div>
      <div className="analysis-grid">
        <article className="analysis-card"><h2><LayoutGrid size={19} /> Répartition par nombre de pièces</h2><p>{stats.count} annonces dans le périmètre courant</p><div className="room-chart">{stats.rooms.map(r => <div className="room-row" key={r.rooms}><span>{r.rooms} pièce{r.rooms > 1 ? 's' : ''}</span><div className="room-track"><span style={{ width: `${r.count / Math.max(stats.count, 1) * 100}%` }} /></div><strong>{r.count}</strong></div>)}{!stats.count && <p>Aucun résultat à répartir. Modifiez vos critères dans le chat.</p>}</div></article>
        <article className="analysis-card"><h2><Check size={19} /> Correspondance avec le projet</h2>{state.criteria.cities.length ? <><div className="tier-summary"><span>Gold <strong>{state.results.gold.length}</strong></span><span>Argent <strong>{state.results.silver.length}</strong></span><span>À confirmer <strong>{state.results.confirm.length}</strong></span></div><p>Les exigences connues sont respectées par les résultats inclus. Les préférences et les données manquantes déterminent leur classement.</p></> : <p>Aucun classement avant de préciser une ville dans la conversation.</p>}<h3 className="mt-4">Critères communs</h3>{state.criteria.requirements.length ? <ul>{state.criteria.requirements.map(r => <li key={r}>{r}</li>)}</ul> : <p>Aucun critère exprimé pour le moment.</p>}<h3 className="mt-4 flex items-center gap-2"><CircleHelp size={16} /> Informations à confirmer</h3>{missing.length ? <ul>{missing.map(m => <li key={m}>{m}</li>)}</ul> : <p>Aucune information manquante signalée dans ce périmètre. Données fictives non vérifiées.</p>}</article>
      </div>
      <article className="analysis-card"><h2><Heart size={19} /> Comparer vos favoris</h2><p>Prix et caractéristiques des favoris du projet, sans estimation de marché.</p>{favorites.length ? <div className="comparison-scroll"><table><thead><tr><th>Logement</th><th>Loyer HC</th><th>Charges</th><th>Total CC</th><th>Surface</th><th>Pièces</th><th>Correspondance</th></tr></thead><tbody>{favorites.map(l => <tr key={l.id}><th><button onClick={() => dispatch({ type: 'HIGHLIGHT', id: l.id, nonce: Date.now() })}>{l.title}<span>{l.city}</span></button></th><td>{euro(l.rent)}</td><td>{euro(l.charges)}</td><td>{euro(totalCost(l))}</td><td>{l.surface} m²</td><td>{l.rooms}</td><td>{state.results.evaluations[l.id]?.included ? <TierBadge tier={state.results.evaluations[l.id].tier} /> : 'Hors périmètre'}</td></tr>)}</tbody></table></div> : <div className="empty-analysis">Ajoutez des logements à vos favoris pour les comparer ici.</div>}</article>
    </div>
  </section>
}
function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <article className="metric-card"><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>
}

