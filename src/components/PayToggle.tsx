import type { PayFilter } from '../types'

interface Props {
  value: PayFilter
  onChange: (next: PayFilter) => void
}

// grey "Toggle unpaid" (all) → red "Hide unpaid" → green "Only unpaid" → back to grey.
const NEXT: Record<PayFilter, PayFilter> = { all: 'hide', hide: 'only', only: 'all' }
const LABEL: Record<PayFilter, string> = {
  all: 'Toggle unpaid',
  hide: 'Hide unpaid',
  only: 'Only unpaid',
}

export function PayToggle({ value, onChange }: Props) {
  return (
    <button
      className={`pay-toggle pay-${value}`}
      onClick={() => onChange(NEXT[value])}
      title="Cycle: show all → hide unpaid → only unpaid"
    >
      {LABEL[value]}
    </button>
  )
}
