import { useEffect, useMemo, useState } from 'react'
import { fetchAllListings } from './lib/supabase'
import type { ChipCount, KeywordMode, Listing, PayFilter } from './types'
import { ListingCard } from './components/ListingCard'
import { ChipFilter } from './components/ChipFilter'
import { PayToggle } from './components/PayToggle'
import { Pagination } from './components/Pagination'

const PAGE_SIZE = 100

// Collapsed keyword chips: intern is a must, then the popular fields.
const PRIORITY_KEYWORDS = ['intern', 'software', 'finance', 'ai', 'aerospace']

const FIELD_TERMS = [
  'software engineer',
  'data',
  'machine learning',
  'artificial intelligence',
  'quantitative',
  'finance',
  'mechanical engineering',
  'electrical engineering',
  'aerospace',
  'robotics',
  'hardware',
  'medical device',
  'biotech',
  'computer science',
  'research scientist',
  'product manager',
  'sales',
  'marketing',
  'operations',
  'business development',
  'product designer',
]

function decodeSlug(slug: string | null): string {
  if (!slug) return ''
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase()
}

function listingKeywords(listing: Listing): string[] {
  const keywordSet = new Set(listing.keywords_matched.map(normalizeKeyword).filter(Boolean))
  const text = `${listing.title ?? ''} ${listing.company ?? ''} ${decodeSlug(listing.company_slug)} ${listing.snippet ?? ''}`.toLowerCase()

  for (const term of FIELD_TERMS) {
    if (text.includes(term)) keywordSet.add(term)
  }

  return [...keywordSet]
}

function isUnpaid(listing: Listing): boolean {
  return (listing.pay ?? '').trim().toLowerCase() === 'unpaid'
}

// Build a count-sorted chip list from a value getter.
function tally(listings: Listing[], get: (l: Listing) => Iterable<string>): ChipCount[] {
  const counts = new Map<string, number>()
  for (const listing of listings) {
    for (const v of get(listing)) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export default function App() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [companySearch, setCompanySearch] = useState('')
  const [snippetSearch, setSnippetSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<KeywordMode>('OR')
  const [countries, setCountries] = useState<Set<string>>(new Set())
  const [payFilter, setPayFilter] = useState<PayFilter>('all')
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchAllListings()
      .then((data) => {
        if (!cancelled) setListings(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Reset to first page whenever the active filters change.
  useEffect(() => {
    setPage(0)
  }, [companySearch, snippetSearch, selected, mode, countries, payFilter])

  const keywordsByListingId = useMemo<Map<string, string[]>>(() => {
    return new Map(listings.map((listing) => [listing.id, listingKeywords(listing)]))
  }, [listings])

  // Distinct keywords across all listings, most common first.
  const availableKeywords = useMemo<ChipCount[]>(() => {
    return tally(listings, (l) => keywordsByListingId.get(l.id) ?? [])
  }, [listings, keywordsByListingId])

  // Distinct countries across all listings, most common first (nulls skipped).
  const availableCountries = useMemo<ChipCount[]>(() => {
    return tally(listings, (l) => (l.country?.trim() ? [l.country.trim()] : []))
  }, [listings])

  // Search + keyword (AND/OR) + country + pay filtering. Source is already
  // sorted newest-first, so filtering preserves that order.
  const filtered = useMemo<Listing[]>(() => {
    const companyTerm = companySearch.trim().toLowerCase()
    const snippetTerm = snippetSearch.trim().toLowerCase()
    const sel = [...selected]

    return listings.filter((l) => {
      if (companyTerm) {
        const company = (l.company ?? '').toLowerCase()
        const slug = decodeSlug(l.company_slug).toLowerCase()
        if (!company.includes(companyTerm) && !slug.includes(companyTerm)) return false
      }

      if (snippetTerm) {
        const snip = l.snippet?.toLowerCase() ?? ''
        if (!snip.includes(snippetTerm)) return false
      }

      if (sel.length > 0) {
        const kw = keywordsByListingId.get(l.id) ?? []
        const matches =
          mode === 'AND' ? sel.every((s) => kw.includes(s)) : sel.some((s) => kw.includes(s))
        if (!matches) return false
      }

      if (countries.size > 0) {
        const c = l.country?.trim() ?? ''
        if (!countries.has(c)) return false
      }

      if (payFilter === 'hide' && isUnpaid(l)) return false
      if (payFilter === 'only' && !isUnpaid(l)) return false

      return true
    })
  }, [listings, companySearch, snippetSearch, selected, mode, countries, payFilter, keywordsByListingId])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  function toggleIn(setter: typeof setSelected, value: string) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1
  const rangeEnd = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <>
      <div className="site-top">
        <div className="topbar">
          <div className="topbar-inner">
            <div className="brand-wrap">
              <img className="brand-icon" src="/favicon.jpeg" alt="Site icon" />
              <h1 className="site-title">Adeel's Internship List</h1>
            </div>
            <a className="top-link" href="/thesis.html">
              My thesis
            </a>
          </div>
        </div>

        <div className="noticebar">
          <div className="noticebar-inner">
            If this is your first time using this site, please read this{' '}
            <a href="/info.html">disclaimer</a>.
          </div>
        </div>
      </div>

      <div className="app">
        <header className="header">
          <div className="search-row">
            <input
              className="search"
              type="search"
              placeholder="Search company…"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
            />
            <input
              className="search"
              type="search"
              placeholder="Search snippet…"
              value={snippetSearch}
              onChange={(e) => setSnippetSearch(e.target.value)}
            />
          </div>

          <ChipFilter
            label="Keywords"
            items={availableKeywords}
            selected={selected}
            onToggle={(v) => toggleIn(setSelected, v)}
            onClear={() => setSelected(new Set())}
            priority={PRIORITY_KEYWORDS}
            collapsedCount={PRIORITY_KEYWORDS.length}
            controls={
              <div className="mode-toggle" role="group" aria-label="Keyword match mode">
                <button
                  className={mode === 'OR' ? 'active' : ''}
                  onClick={() => setMode('OR')}
                  title="Match listings with ANY selected keyword"
                >
                  Any · OR
                </button>
                <button
                  className={mode === 'AND' ? 'active' : ''}
                  onClick={() => setMode('AND')}
                  title="Match listings with ALL selected keywords"
                >
                  All · AND
                </button>
              </div>
            }
          />

          <ChipFilter
            label="Countries"
            items={availableCountries}
            selected={countries}
            onToggle={(v) => toggleIn(setCountries, v)}
            onClear={() => setCountries(new Set())}
            priority={['United States']}
            collapsedCount={6}
            controls={<PayToggle value={payFilter} onChange={setPayFilter} />}
          />
        </header>

        <main className="content">
          {loading && <p className="status">Loading listings…</p>}

          {error && (
            <p className="status status-error">
              Failed to load listings: {error}
            </p>
          )}

          {!loading && !error && (
            <>
              <div className="resultbar">
                {filtered.length === 0 ? (
                  'No listings match your filters.'
                ) : (
                  <>
                    Showing <strong>{rangeStart}–{rangeEnd}</strong> of{' '}
                    <strong>{filtered.length}</strong>
                    {filtered.length !== listings.length && ` (of ${listings.length} total)`}
                  </>
                )}
              </div>

              <div className="list">
                {pageItems.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    keywords={keywordsByListingId.get(l.id) ?? []}
                    activeKeywords={selected}
                  />
                ))}
              </div>

              <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
            </>
          )}
        </main>
      </div>
    </>
  )
}
