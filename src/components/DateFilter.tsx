import type { DateRange } from '../types'

// Single-select, so the chips read as one choice rather than a set.
const OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: '24h', label: 'Past 24 hours' },
  { value: '3d', label: 'Past 3 days' },
  { value: '7d', label: 'Past week' },
  { value: '30d', label: 'Past month' },
]

interface Props {
  value: DateRange
  onChange: (value: DateRange) => void
}

export function DateFilter({ value, onChange }: Props) {
  return (
    <div className="filter-group">
      <div className="group-head">
        {/* first_seen_at is when we parsed the listing, not when the company
            posted it — near enough on an hourly scrape, but say so. */}
        <span className="group-label" title="When the listing was first parsed">
          Date posted
        </span>
      </div>

      <div className="chip-list" role="radiogroup" aria-label="Date posted">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            className={`chip-toggle ${value === o.value ? 'on' : ''}`}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
