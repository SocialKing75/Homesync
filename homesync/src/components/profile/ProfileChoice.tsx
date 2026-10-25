import { useEffect, useRef, useState } from 'react'
import { User, Building2, ArrowRight, Check, Home, CheckCircle2, MessageSquareText } from 'lucide-react'
import { useStore } from '../../store/store'
import type { AccountType } from '../../types'
import './ProfileChoice.css'

const PROFILES = [
  {
    type: 'particulier' as const,
    label: 'Particulier',
    title: 'Pour moi et mes proches',
    description: 'Trouvez votre prochain logement, seul, en couple, en famille ou en colocation.',
    details: ['Recherche partagée', 'Favoris communs'],
    button: 'Commencer ma recherche',
    Icon: User,
  },
  {
    type: 'societe' as const,
    label: 'Société',
    title: 'Pour mon entreprise',
    description: 'Trouvez des logements pour vos collaborateurs, leurs missions et leurs mobilités.',
    details: ['Plusieurs logements', 'Collaboration en équipe'],
    button: 'Loger mon équipe',
    Icon: Building2,
  },
]

export default function ProfileChoice() {
  const { state, dispatch } = useStore()
  const [selected, setSelected] = useState<AccountType | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const choose = (type: AccountType) => {
    if (selected) return
    setSelected(type)
    // Un bref retour d'état précède l'ouverture du parcours, sans animation forcée.
    timer.current = setTimeout(() => dispatch({
      type: 'CHOOSE',
      accountType: type,
      companyName: type === 'societe' ? state.companyName ?? 'Movia Conseil' : undefined,
      preserveExisting: true,
    }), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180)
  }

  return (
    <div className="profile-choice">
      <header className="profile-choice-header"><Logo /></header>
      <main className="profile-choice-main">
        <div className="profile-choice-content">
        <div className="profile-choice-intro">
          <span className="profile-choice-eyebrow"><MessageSquareText size={15} aria-hidden="true" /> Recherche 100 % conversationnelle · Toute la France</span>
          <h1>Votre prochain lieu de vie<br />commence par une <span>conversation.</span></h1>
          <p>Décrivez votre besoin, seul ou à plusieurs.<br />HomeSync vous guide vers votre prochain logement.</p>
        </div>
        <p className="profile-choice-prompt">Je cherche un logement…</p>
        <div className="profile-choice-grid">
          {PROFILES.map(profile => (
            <ProfileCard key={profile.type} profile={profile} selected={selected === profile.type} disabled={selected !== null} onChoose={() => choose(profile.type)} />
          ))}
        </div>
        <p role="status" aria-live="polite" className="profile-choice-status">
          {selected ? <><CheckCircle2 size={15} /> Profil {selected === 'particulier' ? 'particulier' : 'société'} sélectionné. Ouverture de votre recherche…</> : <><Home size={14} /> Deux façons de chercher. Une même envie de se sentir chez soi.</>}
        </p>
        <p className="profile-choice-demo">Profils de démonstration · Sans inscription · Vos informations restent dans votre projet.</p>
        </div>
      </main>
    </div>
  )
}

function ProfileCard({ profile, selected, disabled, onChoose }: { profile: (typeof PROFILES)[number]; selected: boolean; disabled: boolean; onChoose: () => void }) {
  const Icon = profile.Icon
  return (
    <article className={`profile-choice-card ${selected ? 'is-selected' : ''}`} aria-labelledby={`profile-title-${profile.type}`}>
      <div className="profile-choice-card-top">
        <span className="profile-choice-type"><Icon size={16} aria-hidden="true" />{profile.label}</span>
        {selected && <span className="profile-choice-selected"><Check size={17} /> Sélectionné</span>}
      </div>
      <div className="profile-choice-card-body">
        <h2 id={`profile-title-${profile.type}`}>{profile.title}</h2>
        <p>{profile.description}</p>
        <ul>{profile.details.map(detail => <li key={detail}><Check size={13} aria-hidden="true" />{detail}</li>)}</ul>
        <button type="button" onClick={onChoose} disabled={disabled} aria-pressed={selected} aria-label={profile.button}>
          <span>{selected ? 'Votre recherche s’ouvre…' : profile.button}</span><ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-aubergine text-white font-display text-xl font-bold">H</span>
      <span className={`font-display text-xl font-semibold ${light ? 'text-white' : 'text-aubergine'}`}>Home<span className="text-terracotta">Sync</span></span>
    </div>
  )
}

