import { FlaskConical, Check, X } from 'lucide-react'
import { useStore } from '../../store/store'

// Aperçu d'une hypothèse « Et si… ? » — différence visuelle claire (pointillés),
// rien n'est modifié tant que l'utilisateur n'a pas confirmé.
export default function WhatIfBanner() {
  const { state, applyWhatIf, dismissWhatIf } = useStore()
  const wi = state.whatIf
  if (!wi) return null

  return (
    <div className="anim-fade-up rounded-2xl border-2 border-dashed border-terracotta bg-terracotta-100/50 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-terracotta">
        <FlaskConical size={13} /> Aperçu d'une hypothèse
      </p>
      <p className="mt-1 text-sm font-medium text-aubergine">« {wi.question} »</p>
      <p className="mt-1 text-[13px] text-aubergine-400">{wi.summary} Les repères en pointillés sur la carte sont temporaires.</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={applyWhatIf}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-terracotta px-3 py-2 text-sm font-semibold text-white hover:bg-aubergine-700 transition-colors"
        >
          <Check size={15} /> Appliquer
        </button>
        <button
          onClick={dismissWhatIf}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-peche-200 bg-white px-3 py-2 text-sm font-semibold text-aubergine hover:border-terracotta transition-colors"
        >
          <X size={15} /> Annuler
        </button>
      </div>
    </div>
  )
}

