import { useState } from 'react'
import { ChevronDown, ListChecks, Sparkles, HelpCircle } from 'lucide-react'
import { useStore } from '../../store/store'

// Récapitulatif discret des critères compris, modifiable seulement via le chat.
export default function CriteriaRecap() {
  const { state } = useStore()
  const c = state.criteria
  const [open, setOpen] = useState(false)
  const empty = c.requirements.length === 0 && c.preferences.length === 0

  if (empty) return null

  return (
    <div className="criteria-recap border-b border-peche-200/70 bg-creme-100/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <ListChecks size={15} className="text-terracotta" />
        <span className="text-[12px] font-semibold text-aubergine">Ce que j'ai compris</span>
        <span className="text-[11px] text-aubergine-400">
          {c.requirements.length} exigence(s) · {c.preferences.length} préférence(s)
        </span>
        <ChevronDown
          size={15}
          className={`ml-auto text-aubergine-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-2.5 px-4 pb-3 anim-fade-in">
          {c.requirements.length > 0 && (
            <Group icon={<ListChecks size={13} />} title="Exigences indispensables" color="text-aubergine">
              {c.requirements.map((r) => (
                <Chip key={r} className="bg-aubergine text-white">
                  {r}
                </Chip>
              ))}
            </Group>
          )}
          {c.preferences.length > 0 && (
            <Group icon={<Sparkles size={13} />} title="Préférences négociables" color="text-or-700">
              {c.preferences.map((p) => (
                <Chip key={p} className="bg-or-100 text-or-700">
                  {p}
                </Chip>
              ))}
            </Group>
          )}
          {c.toConfirm.length > 0 && (
            <Group icon={<HelpCircle size={13} />} title="À confirmer" color="text-confirmer">
              {c.toConfirm.map((t) => (
                <Chip key={t} className="bg-creme-100 text-confirmer border border-peche-200">
                  {t}
                </Chip>
              ))}
            </Group>
          )}
          <p className="pt-0.5 text-[11px] text-aubergine-400">
            Pour modifier un critère, dites-le simplement dans la conversation.
          </p>
        </div>
      )}
    </div>
  )
}

function Group({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode
  title: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className={`mb-1 flex items-center gap-1.5 text-[11px] font-semibold ${color}`}>
        {icon} {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ${className}`}>{children}</span>
}
