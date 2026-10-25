import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export default function Modal({
  children,
  onClose,
  title,
  icon,
  wide = false,
}: {
  children: React.ReactNode
  onClose: () => void
  title: string
  icon?: React.ReactNode
  wide?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const focusables = () => [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])].filter(node => node.getClientRects().length > 0)
    ;(focusables()[0] ?? panel.current)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); return }
      if (event.key !== 'Tab') return
      const nodes = focusables()
      const first = nodes[0]; const last = nodes[nodes.length - 1]
      if (!first) { event.preventDefault(); panel.current?.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('keydown', onKey, true); if (previous?.isConnected) previous.focus() }
  }, [])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-aubergine/40 backdrop-blur-[2px] anim-fade-in" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        style={{ maxHeight: 'calc(var(--app-height, 100dvh) - 24px)' }}
        className={`anim-slide-up sm:anim-fade-up relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-[var(--shadow-lift)] ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-md'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-peche-200/70 px-4 py-3.5">
          {icon && (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-peche text-aubergine">
              {icon}
            </span>
          )}
          <h2 className="font-display text-lg font-semibold text-aubergine">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-aubergine-400 hover:bg-creme-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  )
}
