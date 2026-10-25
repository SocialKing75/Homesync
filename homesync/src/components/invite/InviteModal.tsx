import { useState } from 'react'
import { UserPlus, Link2, Check, Clock, MapPin } from 'lucide-react'
import { useStore, newId } from '../../store/store'
import { CITIES } from '../../data/cities'
import type { Message, Participant } from '../../types'
import Modal from '../common/Modal'

const COLORS = ['var(--copper-dark)', 'var(--color-argent-700)', 'var(--text-muted)', 'var(--navy)']

export default function InviteModal() {
  const { state, dispatch } = useStore()
  const isCompany = state.accountType === 'societe'
  const [name, setName] = useState('')
  const [role, setRole] = useState<'invite' | 'demandeur'>('invite')
  const [placeCity, setPlaceCity] = useState('')
  const [placeLabel, setPlaceLabel] = useState(isCompany ? 'Site de la société' : 'Lieu de travail')
  const [sent, setSent] = useState(false)
  const [copyError, setCopyError] = useState(false)

  if (!state.inviteOpen) return null
  const close = () => dispatch({ type: 'SET_INVITE', v: false })

  const invite = () => {
    if (!name.trim()) return
    const initials = name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    const city = CITIES.find((c) => c.name === placeCity)
    const p: Participant = {
      id: newId('p'),
      name: name.trim(),
      initials,
      color: COLORS[(state.participants.length - 1) % COLORS.length],
      role,
      place: city
        ? { label: placeLabel, lat: city.lat + 0.01, lng: city.lng + 0.01 }
        : undefined,
    }
    const msg: Message = {
      id: newId('ai'),
      sender: 'ai',
      text: `${p.name} a rejoint le projet${
        p.place ? ` et a ajouté « ${p.place.label} » à ${placeCity} sur la carte` : ''
      }. La recherche reste commune : je ne modifie pas une exigence partagée sans votre accord.`,
      ts: Date.now(),
    }
    dispatch({ type: 'ADD_PARTICIPANT', p, msg })
  }

  return (
    <Modal onClose={close} title="Inviter un participant" icon={<UserPlus size={18} />}>
      <p className="text-[13px] text-aubergine-400">
        {isCompany
          ? 'Invitez un collègue à rejoindre ce projet de recherche. Il pourra consulter la carte, proposer des logements et discuter avec l’assistant.'
          : 'Invitez votre partenaire, un proche ou un futur colocataire. Vous chercherez ensemble, dans la même conversation.'}
      </p>

      <label className="mt-4 block text-[12px] font-semibold text-aubergine">Nom</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={isCompany ? 'ex. Karim (manager)' : 'ex. Léa'}
        className="mt-1 w-full rounded-xl border border-peche-200 bg-white px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none"
      />

      <label className="mt-3 block text-[12px] font-semibold text-aubergine">Rôle dans le projet</label>
      <div className="mt-1 flex gap-2">
        {(['invite', 'demandeur'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              role === r ? 'border-terracotta bg-terracotta-100 text-terracotta' : 'border-peche-200 text-aubergine-400'
            }`}
          >
            {r === 'invite' ? 'Membre invité' : 'Co-demandeur'}
          </button>
        ))}
      </div>

      <label className="mt-3 block text-[12px] font-semibold text-aubergine">
        <MapPin size={12} className="mr-1 inline" /> Lieu important (optionnel)
      </label>
      <div className="mt-1 flex gap-2">
        <input
          value={placeLabel}
          onChange={(e) => setPlaceLabel(e.target.value)}
          className="w-1/2 rounded-xl border border-peche-200 bg-white px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none"
        />
        <select
          value={placeCity}
          onChange={(e) => setPlaceCity(e.target.value)}
          className="w-1/2 rounded-xl border border-peche-200 bg-white px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none"
        >
          <option value="">— Ville —</option>
          {CITIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={invite}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-3 py-2.5 text-sm font-semibold text-white hover:bg-aubergine-700 transition-colors"
      >
        <UserPlus size={16} /> Ajouter au projet
      </button>

      <div className="mt-3 rounded-xl border border-peche-200 bg-creme-100/60 p-3">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-aubergine">
          <Link2 size={13} /> Ou partager un lien d'invitation
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-white px-2.5 py-1.5 text-[12px] text-aubergine-400">
            {window.location.origin}/?invitation=demo
          </code>
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(`${window.location.origin}/?invitation=demo`); setSent(true); setCopyError(false) }
              catch { setCopyError(true) }
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-peche-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-aubergine hover:border-terracotta"
          >
            {sent ? <Check size={13} /> : <Link2 size={13} />} {sent ? 'Copié' : 'Copier'}
          </button>
        </div>
        {copyError && <p className="mt-2 text-xs text-terracotta">Copie indisponible dans ce navigateur. Lien de démonstration uniquement.</p>}
        {sent && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-confirmer">
            <Clock size={13} /> Invitation en attente (démonstration — aucun e-mail réel n'est envoyé).
          </p>
        )}
      </div>
    </Modal>
  )
}

