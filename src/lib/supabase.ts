import { createClient } from '@supabase/supabase-js'
import type { ChipCount, DateRange, Facets, Listing, ListingPage, ListingQuery } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Add them to .env.local (must be VITE_-prefixed for Vite to expose them).',
  )
}

export const supabase = createClient(url, anonKey)

// Only these columns are needed to render a listing.
const COLUMNS =
  'id, canonical_url, title, company_slug, ats_source, company, pay, location, country, keywords_matched, snippet, first_seen_at'

// The three columns the chip filters are built from. They are small enough
// that sweeping every row costs ~350 kB gzipped, against ~11 MB for the full
// rows — which is why the board can afford exact counts without an RPC.
const FACET_COLUMNS = 'country, ats_source, keywords_matched'

// PostgREST caps a single response at 1000 rows.
const BATCH = 1000

// How many sweep pages to keep in flight at once.
const SWEEP_CONCURRENCY = 8

const DAYS: Record<Exclude<DateRange, 'any'>, number> = {
  '24h': 1,
  '3d': 3,
  '7d': 7,
  '30d': 30,
}

/* PostgREST splits `or=(…)` on commas and `{…}` array literals on commas too,
   so any value that might contain one has to be double-quoted and its quotes
   and backslashes escaped. */
function quote(value: string): string {
  return `"${value.replace(/["\\]/g, '\\$&')}"`
}

function arrayLiteral(values: string[]): string {
  return `{${values.map(quote).join(',')}}`
}

function cutoffISO(range: DateRange): string | null {
  if (range === 'any') return null
  return new Date(Date.now() - DAYS[range] * 86_400_000).toISOString()
}

/* Every filter the UI offers, pushed down into one PostgREST query so the
   database does the work and the browser only ever sees a page. Typed loosely
   because the filter builder and the final response builder differ in shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters<T>(builder: T, query: ListingQuery): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = builder as any

  const company = query.company.trim()
  if (company) {
    const v = quote(`%${company}%`)
    // The display name is often null, so fall back to the slug we scraped.
    q = q.or(`company.ilike.${v},company_slug.ilike.${v}`)
  }

  const text = query.text.trim()
  if (text) {
    const v = quote(`%${text}%`)
    q = q.or(`title.ilike.${v},snippet.ilike.${v}`)
  }

  if (query.keywords.length > 0) {
    const lit = arrayLiteral(query.keywords)
    if (query.keywordMode === 'AND') q = q.filter('keywords_matched', 'cs', lit)
    else if (query.keywordMode === 'NOT') q = q.not('keywords_matched', 'ov', lit)
    else q = q.filter('keywords_matched', 'ov', lit)
  }

  if (query.countries.length > 0) q = q.in('country', query.countries)
  if (query.atsSources.length > 0) q = q.in('ats_source', query.atsSources)

  const since = cutoffISO(query.dateRange)
  if (since) q = q.gte('first_seen_at', since)

  return q as T
}

/* One page of listings, plus how many rows match in total so the pager knows
   how far it can go. Newest first. */
export async function fetchListingPage(query: ListingQuery): Promise<ListingPage> {
  const from = query.page * query.pageSize
  const to = from + query.pageSize - 1

  const { data, count, error } = await applyFilters(
    supabase.from('listings').select(COLUMNS, { count: 'exact' }),
    query,
  )
    .order('first_seen_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  return { rows: (data ?? []) as unknown as Listing[], total: count ?? 0 }
}

// Count-sorted chips from a value getter.
function tally(rows: FacetRow[], get: (r: FacetRow) => Iterable<string>): ChipCount[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const v of get(row)) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

interface FacetRow {
  country: string | null
  ats_source: string | null
  keywords_matched: string[] | null
}

// Run `task` over [0, n) with a fixed number of requests in flight.
async function pool<T>(n: number, limit: number, task: (i: number) => Promise<T>): Promise<T[]> {
  const results = new Array<T>(n)
  let next = 0

  const workers = Array.from({ length: Math.min(limit, n) }, async () => {
    for (let i = next++; i < n; i = next++) {
      results[i] = await task(i)
    }
  })

  await Promise.all(workers)
  return results
}

/* The sweep is the one expensive thing the board still does, and the answer
   only moves when the scraper runs, so keep it for the tab. */
const FACET_CACHE_KEY = 'facets.v1'
const FACET_TTL = 15 * 60 * 1000

function readFacetCache(): Facets | null {
  try {
    const raw = sessionStorage.getItem(FACET_CACHE_KEY)
    if (!raw) return null
    const { at, facets } = JSON.parse(raw) as { at: number; facets: Facets }
    return Date.now() - at < FACET_TTL ? facets : null
  } catch {
    return null // private browsing, or a cache written by an older build
  }
}

function writeFacetCache(facets: Facets): void {
  try {
    sessionStorage.setItem(FACET_CACHE_KEY, JSON.stringify({ at: Date.now(), facets }))
  } catch {
    /* the sweep just runs again next time */
  }
}

export async function fetchFacets(): Promise<Facets> {
  const cached = readFacetCache()
  if (cached) return cached

  const facets = await sweepFacets()
  writeFacetCache(facets)
  return facets
}

/* The chip vocabularies and their counts. Counts are global — they say how
   many listings carry a value in total, not how many survive the other
   filters — which is what the board showed before it paginated server-side.

   Ordered by id (the primary key, so it is an index scan) because .range()
   over an unordered table is not stable across pages. */
async function sweepFacets(): Promise<Facets> {
  const { count, error: countError } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })

  if (countError) throw new Error(countError.message)

  const total = count ?? 0
  const pages = Math.ceil(total / BATCH)

  const chunks = await pool(pages, SWEEP_CONCURRENCY, async (i) => {
    const { data, error } = await supabase
      .from('listings')
      .select(FACET_COLUMNS)
      .order('id')
      .range(i * BATCH, i * BATCH + BATCH - 1)

    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as FacetRow[]
  })

  const rows = chunks.flat()

  return {
    keywords: tally(rows, (r) => r.keywords_matched ?? []),
    countries: tally(rows, (r) => (r.country?.trim() ? [r.country.trim()] : [])),
    atsSources: tally(rows, (r) => (r.ats_source?.trim() ? [r.ats_source.trim()] : [])),
    total,
  }
}
