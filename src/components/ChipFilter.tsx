import { useMemo, useState, type ReactNode } from 'react'
import type { ChipCount } from '../types'

interface Props {
  label: string
  items: ChipCount[] // full list, pre-sorted (usually by count desc)
  selected: Set<string>
  onToggle: (value: string) => void
  onClear: () => void
  // Values pinned to the front and always shown when collapsed.
  priority?: string[]
  // How many chips to show when collapsed (selected chips are always shown too).
  collapsedCount?: number
  // Extra controls rendered in the header (mode toggle, pay toggle, …).
  controls?: ReactNode
}

export function ChipFilter({
  label,
  items,
  selected,
  onToggle,
  onClear,
  priority = [],
  collapsedCount = 8,
  controls,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  // Priority items first (in the given order), then the rest in their original order.
  const ordered = useMemo<ChipCount[]>(() => {
    const prioritySet = new Set(priority)
    const pinned = priority
      .map((p) => items.find((i) => i.value === p))
      .filter((i): i is ChipCount => Boolean(i))
    const rest = items.filter((i) => !prioritySet.has(i.value))
    return [...pinned, ...rest]
  }, [items, priority])

  // Collapsed view: the first N, plus any selected chips so they never hide.
  const baseCount = Math.max(collapsedCount, priority.length)
  const visible = useMemo<ChipCount[]>(() => {
    if (expanded) return ordered
    const baseSet = new Set(ordered.slice(0, baseCount).map((i) => i.value))
    return ordered.filter((i) => baseSet.has(i.value) || selected.has(i.value))
  }, [ordered, expanded, baseCount, selected])

  if (items.length === 0) return null

  const hiddenCount = ordered.length - visible.length

  return (
    <div className="chipfilter">
      <div className="chipfilter-head">
        <span className="chipfilter-label">{label}</span>
        {controls}
        {selected.size > 0 && (
          <button className="chip-clear" onClick={onClear}>
            Clear ({selected.size})
          </button>
        )}
      </div>

      <div className="chip-list">
        {visible.map(({ value, count }) => {
          const on = selected.has(value)
          return (
            <button
              key={value}
              className={`chip-toggle ${on ? 'on' : ''}`}
              onClick={() => onToggle(value)}
              aria-pressed={on}
            >
              {value}
              <span className="chip-count">{count}</span>
            </button>
          )
        })}

        {(hiddenCount > 0 || expanded) && (
          <button className="chip-more" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Less ▲' : `More (+${hiddenCount}) ▼`}
          </button>
        )}
      </div>
    </div>
  )
}
