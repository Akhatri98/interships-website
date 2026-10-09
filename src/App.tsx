import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchFacetRows, fetchListingPage, fetchTotal } from './lib/supabase'
import { countFacets } from './lib/facets'
import type { DateRange, FacetRow, KeywordMode, Listing, ListingQuery } from './types'
import { ListingCard } from './components/ListingCard'
import { ChipFilter } from './components/ChipFilter'
import { DateFilter } from './components/DateFilter'
import { Pagination } from './components/Pagination'

const PAGE_SIZE = 100

// Collapsed keyword chips: intern is a must, then the popular fields. These
// have to match the scraper's own keyword values exactly, casing included.
const PRIORITY_KEYWORDS = ['intern', 'software', 'data', 'finance', 'AI']

const MODES: { value: KeywordMode; label: string; title: string }[] = [
  { value: 'OR', label: 'Any · OR', title: 'Listings with ANY selected keyword' },
  { value: 'AND', label: 'All · AND', title: 'Listings with ALL selected keywords' },
  { value: 'NOT', label: 'None · NOT', title: 'Listings with NONE of the selected keywords' },
]

const DEFAULT_FILTERS = {
  company: '',
  text: '',
  topOnly: false,
  keywords: ['intern', 'software'] as string[],
  mode: 'AND' as KeywordMode,
  countries: ['United States'] as string[],
  atsSources: ['greenhouse', 'lever', 'ashby'] as string[],
  dateRange: '7d' as DateRange,
}

type Filters = typeof DEFAULT_FILTERS

/* Filters go in sessionStorage rather than localStorage on purpose: a refresh
   (or a back/forward) keeps whatever you had set, a brand-new tab starts over
   from the defaults above. */
const FILTERS_KEY = 'filters'

function readFilters(): Filters {
  try {
    const saved = sessionStorage.getItem(FILTERS_KEY)
    if (saved) return { ...DEFAULT_FILTERS, ...(JSON.parse(saved) as Partial<Filters>) }
  } catch {
    /* blocked storage, or a stale/garbled entry — just use the defaults */
  }
  return DEFAULT_FILTERS
}

// Read once per page load, so StrictMode's double mount can't re-read it.
const INITIAL_FILTERS = readFilters()

/* The warning under the masthead stays shut once closed. Rename the key when
   the warning says something new, so it shows again for everyone. */
const NOTICE_KEY = 'notice.workday-dates'

function readNoticeOpen(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === null
  } catch {
    return true
  }
}

type Theme = 'light' | 'dark'

/* The inline script in index.html has already stamped <html data-theme>, so
   we read the edition off the document rather than guessing it again. */
function useEdition(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Until the reader picks an edition, keep following the system setting.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!localStorage.getItem('theme')) setTheme(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    setTheme((cur) => {
      const next: Theme = cur === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem('theme', next)
      } catch {
        /* private browsing — the choice just won't outlive the tab */
      }
      return next
    })
  }

  return [theme, toggle]
}

// Typing shouldn't put a query on the wire per keystroke.
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])

  return settled
}

export default function App() {
  const [theme, toggleEdition] = useEdition()
  const [noticeOpen, setNoticeOpen] = useState(readNoticeOpen)

  function dismissNotice() {
    setNoticeOpen(false)
    try {
      localStorage.setItem(NOTICE_KEY, 'dismissed')
    } catch {
      /* private browsing — it just comes back next visit */
    }
  }

  const [companyInput, setCompanyInput] = useState(INITIAL_FILTERS.company)
  const [textInput, setTextInput] = useState(INITIAL_FILTERS.text)
  const [topOnly, setTopOnly] = useState(INITIAL_FILTERS.topOnly)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(INITIAL_FILTERS.keywords))
  const [mode, setMode] = useState<KeywordMode>(INITIAL_FILTERS.mode)
  const [countries, setCountries] = useState<Set<string>>(() => new Set(INITIAL_FILTERS.countries))
  const [atsSources, setAtsSources] = useState<Set<string>>(
    () => new Set(INITIAL_FILTERS.atsSources),
  )
  const [dateRange, setDateRange] = useState<DateRange>(INITIAL_FILTERS.dateRange)
  const [page, setPage] = useState(0)

  const [rows, setRows] = useState<Listing[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false) // has a first page ever landed?
  const [error, setError] = useState<string | null>(null)

  const [facetRows, setFacetRows] = useState<FacetRow[] | null>(null)
  const [facetsLoading, setFacetsLoading] = useState(true)
  const [facetError, setFacetError] = useState<string | null>(null)
  const [boardTotal, setBoardTotal] = useState<number | null>(null)

  const company = useDebounced(companyInput, 300)
  const text = useDebounced(textInput, 300)

  const query = useMemo<ListingQuery>(
    () => ({
      company,
      text,
      topOnly,
      keywords: [...selected],
      keywordMode: mode,
      countries: [...countries],
      atsSources: [...atsSources],
      dateRange,
      page,
      pageSize: PAGE_SIZE,
    }),
    [company, text, topOnly, selected, mode, countries, atsSources, dateRange, page],
  )

  /* One page at a time, straight from the database. Responses can land out of
     order when filters change quickly, so only the newest one is allowed to
     write to state. */
  const seq = useRef(0)
  useEffect(() => {
    const id = ++seq.current
    setLoading(true)

    fetchListingPage(query)
      .then((result) => {
        if (seq.current !== id) return
        setRows(result.rows)
        setTotal(result.total)
        setError(null)
        setLoaded(true)
      })
      .catch((err: unknown) => {
        if (seq.current !== id) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (seq.current === id) setLoading(false)
      })
  }, [query])

  /* The chip vocabularies come from a separate, much narrower sweep of every
     row the searches and date range let through. It runs alongside the first
     page rather than blocking it, so the listings show up first and the
     filters fill in a moment later. Changing a search or the range re-sweeps;
     the old counts stay up, faded, until the new ones land. */
  useEffect(() => {
    let cancelled = false
    setFacetsLoading(true)

    fetchFacetRows({ company, text, topOnly, dateRange })
      .then((rows) => {
        if (cancelled) return
        setFacetRows(rows)
        setFacetError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setFacetError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setFacetsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [company, text, topOnly, dateRange])

  // The chips themselves are counted here, so a click re-counts the other
  // sections without a round trip.
  const facets = useMemo(
    () =>
      facetRows &&
      countFacets(facetRows, { keywords: selected, mode, countries, atsSources }),
    [facetRows, selected, mode, countries, atsSources],
  )

  useEffect(() => {
    fetchTotal()
      .then(setBoardTotal)
      .catch(() => {
        /* the masthead just goes without a count */
      })
  }, [])

  // Hold the filter set for the life of this tab, so a refresh picks up where
  // the reader left off instead of snapping back to the defaults.
  useEffect(() => {
    const filters: Filters = {
      company: companyInput,
      text: textInput,
      topOnly,
      keywords: [...selected],
      mode,
      countries: [...countries],
      atsSources: [...atsSources],
      dateRange,
    }

    try {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
    } catch {
    }
  }, [companyInput, textInput, topOnly, selected, mode, countries, atsSources, dateRange])

  // Any filter change puts you back on the first page. Both updates land in
  // one React batch, so it costs one request, not two.
  function onFilterChange(apply: () => void) {
    setPage(0)
    apply()
  }

  function toggleIn(setter: typeof setSelected, value: string) {
    onFilterChange(() =>
      setter((prev) => {
        const next = new Set(prev)
        if (next.has(value)) next.delete(value)
        else next.add(value)
        return next
      }),
    )
  }

  function goToPage(next: number) {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min(total, page * PAGE_SIZE + PAGE_SIZE)
  const filtering = boardTotal !== null && total !== boardTotal

  return (
    <div className="app">
      <header className="masthead">
        <h1 className="site-title">Adeel's Job List</h1>
        <p className="meta">
          <span>Internship and New grad roles</span>
          <span>{boardTotal !== null ? `${boardTotal.toLocaleString()} listings` : ''}</span>
        </p>

        <nav className="mast-nav">
          <span className="mast-links">
            First time here? See <a href="/info.html">more info</a>
          </span>
          <button
            className="edition"
            onClick={toggleEdition}
            aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </nav>

        {noticeOpen && (
          <div className="notice" role="note">
            <span>Workday date parsing is WIP: posting dates may not be accurate to the listing.</span>
            <button className="notice-close" onClick={dismissNotice} aria-label="Dismiss this warning">
              ×
            </button>
          </div>
        )}
      </header>

      <section className="block">
        <h2 className="block-label">Filters</h2>

        <div className="fields">
          <input
            className="search"
            type="search"
            placeholder="Company…"
            aria-label="Search company"
            value={companyInput}
            onChange={(e) => onFilterChange(() => setCompanyInput(e.target.value))}
          />
          <input
            className="search"
            type="search"
            placeholder="Title or description…"
            aria-label="Search title or description"
            value={textInput}
            onChange={(e) => onFilterChange(() => setTextInput(e.target.value))}
          />
        </div>

        <div className="filter-group">
          <div className="group-head">
            <span className="group-label">Companies</span>
          </div>

          <div className="chip-list">
            <button
              className={`chip-toggle ${topOnly ? 'on' : ''}`}
              aria-pressed={topOnly}
              title="Only the hand-picked top tech companies, the listings framed in red"
              onClick={() => onFilterChange(() => setTopOnly((on) => !on))}
            >
              Top companies only
            </button>
          </div>
        </div>

        <DateFilter value={dateRange} onChange={(v) => onFilterChange(() => setDateRange(v))} />

        {facetError && <p className="group-note">Filters unavailable: {facetError}</p>}

        {facets && (
          <div className={facetsLoading ? 'is-counting' : ''}>
            <ChipFilter
              label="Keywords"
              items={facets.keywords}
              selected={selected}
              onToggle={(v) => toggleIn(setSelected, v)}
              onClear={() => onFilterChange(() => setSelected(new Set()))}
              priority={PRIORITY_KEYWORDS}
              collapsedCount={PRIORITY_KEYWORDS.length}
              controls={
                <div className="mode-toggle" role="group" aria-label="Keyword match mode">
                  {MODES.map((m) => (
                    <button
                      key={m.value}
                      className={mode === m.value ? 'active' : ''}
                      onClick={() => onFilterChange(() => setMode(m.value))}
                      title={m.title}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              }
            />

            <ChipFilter
              label="Countries"
              items={facets.countries}
              selected={countries}
              onToggle={(v) => toggleIn(setCountries, v)}
              onClear={() => onFilterChange(() => setCountries(new Set()))}
              priority={['United States']}
              collapsedCount={6}
            />

            <ChipFilter
              label="ATS source"
              items={facets.atsSources}
              selected={atsSources}
              onToggle={(v) => toggleIn(setAtsSources, v)}
              onClear={() => onFilterChange(() => setAtsSources(new Set()))}
              collapsedCount={6}
            />
          </div>
        )}
      </section>

      <main className="block">
        <h2 className="block-label">Listings</h2>

        {error && <p className="status status-error">Failed to load listings: {error}</p>}

        {!error && !loaded && <p className="status">Loading listings…</p>}

        {!error && loaded && (
          <>
            <p className="resultbar">
              {total === 0 ? (
                'No listings match your filters.'
              ) : (
                <>
                  Showing{' '}
                  <strong>
                    {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
                  </strong>{' '}
                  of <strong>{total.toLocaleString()}</strong>
                  {filtering && ` (of ${boardTotal.toLocaleString()} total)`}
                </>
              )}
              {loading && <span className="working"> · working…</span>}
            </p>

            <div className={`list ${loading ? 'is-stale' : ''}`}>
              {rows.map((l) => (
                <ListingCard key={l.id} listing={l} activeKeywords={selected} />
              ))}
            </div>

            <Pagination page={page} pageCount={pageCount} onPage={goToPage} />
          </>
        )}
      </main>
    </div>
  )
}
