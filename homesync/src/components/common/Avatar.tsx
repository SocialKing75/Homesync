import type { Participant } from '../../types'

export function Avatar({ p, size = 32, ring = true }: { p: Participant; size?: number; ring?: boolean }) {
  return (
    <div
      title={`${p.name} · ${p.role}`}
      className="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        background: p.color,
        fontSize: size * 0.4,
        boxShadow: ring ? '0 0 0 2px #FFF5E1' : undefined,
      }}
    >
      {p.initials}
    </div>
  )
}

export function AvatarStack({ participants, max = 4 }: { participants: Participant[]; max?: number }) {
  const shown = participants.slice(0, max)
  const extra = participants.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar p={p} size={30} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="inline-flex items-center justify-center rounded-full bg-peche text-aubergine text-xs font-semibold"
          style={{ width: 30, height: 30, marginLeft: -8, boxShadow: '0 0 0 2px #FFF5E1' }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

