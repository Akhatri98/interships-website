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
  // Extra controls rendered beside the label (the match-mode toggle).
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
    // A selected value can drop out of `items` when nothing in the date range
    // carries it; keep it at 0 so it can still be switched off.
    const known = new Set(items.map((i) => i.value))
    const orphans = [...selected].filter((v) => !known.has(v)).map((value) => ({ value, count: 0 }))
    const all = [...items, ...orphans]

    const prioritySet = new Set(priority)
    const pinned = priority
      .map((p) => all.find((i) => i.value === p))
      .filter((i): i is ChipCount => Boolean(i))
    const rest = all.filter((i) => !prioritySet.has(i.value))
    return [...pinned, ...rest]
  }, [items, priority, selected])

  // Collapsed view: the first N, plus any selected chips so they never hide.
  const baseCount = Math.max(collapsedCount, priority.length)
  const visible = useMemo<ChipCount[]>(() => {
    if (expanded) return ordered
    const baseSet = new Set(ordered.slice(0, baseCount).map((i) => i.value))
    return ordered.filter((i) => baseSet.has(i.value) || selected.has(i.value))
  }, [ordered, expanded, baseCount, selected])

  if (ordered.length === 0) return null

  const hiddenCount = ordered.length - visible.length

  return (
    <div className="filter-group">
      <div className="group-head">
        <span className="group-label">{label}</span>
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
              <span className="chip-count">{count.toLocaleString()}</span>
            </button>
          )
        })}

        {(hiddenCount > 0 || expanded) && (
          <button className="chip-more" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Less' : `More +${hiddenCount}`}
          </button>
        )}
      </div>
    </div>
  )
}
