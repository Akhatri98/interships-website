import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchFacets, fetchListingPage } from './lib/supabase'
import type { DateRange, Facets, KeywordMode, Listing, ListingQuery } from './types'
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
  keywords: ['intern', 'software'] as string[],
  mode: 'AND' as KeywordMode,
  countries: ['United States'] as string[],
  atsSources: [] as string[],
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

  const [companyInput, setCompanyInput] = useState(INITIAL_FILTERS.company)
  const [textInput, setTextInput] = useState(INITIAL_FILTERS.text)
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

  const [facets, setFacets] = useState<Facets | null>(null)
  const [facetError, setFacetError] = useState<string | null>(null)

  const company = useDebounced(companyInput, 300)
  const text = useDebounced(textInput, 300)

  const query = useMemo<ListingQuery>(
    () => ({
      company,
      text,
      keywords: [...selected],
      keywordMode: mode,
      countries: [...countries],
      atsSources: [...atsSources],
      dateRange,
      page,
      pageSize: PAGE_SIZE,
    }),
    [company, text, selected, mode, countries, atsSources, dateRange, page],
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

  /* The chip vocabularies come from a separate, much narrower sweep of the
     whole table. It runs alongside the first page rather than blocking it, so
     the listings show up first and the filters fill in a moment later. */
  useEffect(() => {
    let cancelled = false

    fetchFacets()
      .then((f) => {
        if (!cancelled) setFacets(f)
      })
      .catch((err: unknown) => {
        if (!cancelled) setFacetError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Hold the filter set for the life of this tab, so a refresh picks up where
  // the reader left off instead of snapping back to the defaults.
  useEffect(() => {
    const filters: Filters = {
      company: companyInput,
      text: textInput,
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
  }, [companyInput, textInput, selected, mode, countries, atsSources, dateRange])

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
  const filtering = facets !== null && total !== facets.total

  return (
    <div className="app">
      <header className="masthead">
        <h1 className="site-title">Adeel's Internship List</h1>
        <p className="meta">
          <span>Scraped from ATS boards</span>
          <span>{facets ? `${facets.total.toLocaleString()} listings` : ''}</span>
        </p>

        <nav className="mast-nav">
          <span className="mast-links">
            First time here? Please read the <a href="/info.html">disclaimer</a>
          </span>
          <button
            className="edition"
            onClick={toggleEdition}
            aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </nav>
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

        <DateFilter value={dateRange} onChange={(v) => onFilterChange(() => setDateRange(v))} />

        {facetError && <p className="group-note">Filters unavailable: {facetError}</p>}

        {facets && (
          <>
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
          </>
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
                  {filtering && ` (of ${facets.total.toLocaleString()} total)`}
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
