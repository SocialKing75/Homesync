import type { MatchTier } from '../../types'

const META: Record<MatchTier, { label: string; cls: string; dot: string }> = {
  gold: { label: 'Meilleur accord', cls: 'bg-or-100 text-or-700', dot: '#B88A24' },
  silver: { label: 'Compromis possible', cls: 'bg-argent-100 text-argent-700', dot: '#5f7085' },
  confirm: { label: 'À confirmer', cls: 'bg-creme-100 text-confirmer', dot: 'var(--text-muted)' },
}

export function TierBadge({ tier, className = '' }: { tier: MatchTier; className?: string }) {
  const m = META[tier]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-current/25 px-2.5 py-1 text-[11px] font-semibold ${m.cls} ${className}`}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  )
}

export const tierLabel = (t: MatchTier) => META[t].label

