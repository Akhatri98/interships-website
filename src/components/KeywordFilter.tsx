import type { KeywordCount, KeywordMode } from '../types'

interface Props {
  keywords: KeywordCount[]
  selected: Set<string>
  mode: KeywordMode
  onToggle: (keyword: string) => void
  onModeChange: (mode: KeywordMode) => void
  onClear: () => void
}

export function KeywordFilter({ keywords, selected, mode, onToggle, onModeChange, onClear }: Props) {
  if (keywords.length === 0) return null

  return (
    <div className="kwfilter">
      <div className="kwfilter-head">
        <span className="kwfilter-label">Keywords</span>

        <div className="mode-toggle" role="group" aria-label="Keyword match mode">
          <button
            className={mode === 'OR' ? 'active' : ''}
            onClick={() => onModeChange('OR')}
            title="Match listings with ANY selected keyword"
          >
            Any · OR
          </button>
          <button
            className={mode === 'AND' ? 'active' : ''}
            onClick={() => onModeChange('AND')}
            title="Match listings with ALL selected keywords"
          >
            All · AND
          </button>
        </div>

        {selected.size > 0 && (
          <button className="kw-clear" onClick={onClear}>
            Clear ({selected.size})
          </button>
        )}
      </div>

      <div className="kw-list">
        {keywords.map(({ keyword, count }) => {
          const on = selected.has(keyword)
          return (
            <button
              key={keyword}
              className={`kw-toggle ${on ? 'on' : ''}`}
              onClick={() => onToggle(keyword)}
              aria-pressed={on}
            >
              {keyword}
              <span className="kw-count">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
