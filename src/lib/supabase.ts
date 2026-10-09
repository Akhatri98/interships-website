import { createClient } from '@supabase/supabase-js'
import type { DateRange, FacetRow, FacetScope, Listing, ListingPage, ListingQuery } from '../types'
import { TOP_BOARDS } from './topCompanies'

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
// that a sweep costs ~11 kB gzipped per thousand rows, against ~500 kB for the
// full rows — which is why the board can afford exact counts without an RPC.
// first_seen_at stays out of it on purpose: it would more than double that, so
// the date range (and the searches) are applied server-side and each scope is
// swept on its own.
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

/* "Top companies only" as one or=(…): per ATS, the listing's slug has to be
   one of that ATS's boards. Workday slugs carry a site after the tenant, so
   those are matched as a regex over the tenant instead. Built once — it's the
   same couple of kB on every request that asks for it. */
const TOP_COMPANY_FILTER = [...TOP_BOARDS]
  .map(([ats, slugs]) => {
    const test =
      ats === 'workday'
        ? `company_slug.match.${quote(`^(${[...slugs].join('|')})[.]wd[0-9]+/`)}`
        : `company_slug.in.(${[...slugs].map(quote).join(',')})`
    return `and(ats_source.eq.${quote(ats)},${test})`
  })
  .join(',')

function cutoffISO(range: DateRange): string | null {
  if (range === 'any') return null
  return new Date(Date.now() - DAYS[range] * 86_400_000).toISOString()
}

/* The searches and the date range: the filters the chip counts are swept
   under. Pass `since` to pin the cutoff, so a count and the pages fetched
   after it describe the same rows. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyScope<T>(builder: T, scope: FacetScope, since = cutoffISO(scope.dateRange)): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = builder as any

  const company = scope.company.trim()
  if (company) {
    const v = quote(`%${company}%`)
    // The display name is often null, so fall back to the slug we scraped.
    q = q.or(`company.ilike.${v},company_slug.ilike.${v}`)
  }

  const text = scope.text.trim()
  if (text) {
    const v = quote(`%${text}%`)
    q = q.or(`title.ilike.${v},snippet.ilike.${v}`)
  }

  if (scope.topOnly) q = q.or(TOP_COMPANY_FILTER)

  if (since) q = q.gte('first_seen_at', since)

  return q as T
}

/* Every filter the UI offers, pushed down into one PostgREST query so the
   database does the work and the browser only ever sees a page. Typed loosely
   because the filter builder and the final response builder differ in shape.
   The chip filters here are mirrored in the browser by countFacets() — change
   one, change the other. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters<T>(builder: T, query: ListingQuery): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = applyScope(builder, query) as any

  if (query.keywords.length > 0) {
    const lit = arrayLiteral(query.keywords)
    if (query.keywordMode === 'AND') q = q.filter('keywords_matched', 'cs', lit)
    else if (query.keywordMode === 'NOT') q = q.not('keywords_matched', 'ov', lit)
    else q = q.filter('keywords_matched', 'ov', lit)
  }

  if (query.countries.length > 0) q = q.in('country', query.countries)
  if (query.atsSources.length > 0) q = q.in('ats_source', query.atsSources)

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

/* The sweep is the one expensive thing the board still does, and its answer
   only moves when the scraper runs, so keep each one a while, keyed by the
   scope it was swept under. The promise is what's kept, so two asks for the
   same scope share one sweep. Memory only: an "any time" sweep is too big to
   park in sessionStorage, so a refresh sweeps again. */
const FACET_TTL = 15 * 60 * 1000
const FACET_CACHE_SIZE = 12
const sweeps = new Map<string, { at: number; rows: Promise<FacetRow[]> }>()

export function fetchFacetRows(scope: FacetScope): Promise<FacetRow[]> {
  const key = JSON.stringify([scope.dateRange, scope.company.trim(), scope.text.trim(), scope.topOnly])
  const hit = sweeps.get(key)
  if (hit && Date.now() - hit.at < FACET_TTL) return hit.rows

  const rows = sweepFacetRows(scope)
  sweeps.delete(key) // re-insert at the end, so the oldest scope is evicted first
  sweeps.set(key, { at: Date.now(), rows })

  const oldest = sweeps.keys().next().value
  if (sweeps.size > FACET_CACHE_SIZE && oldest !== undefined) sweeps.delete(oldest)

  // A failed sweep shouldn't be handed out again.
  rows.catch(() => {
    if (sweeps.get(key)?.rows === rows) sweeps.delete(key)
  })

  return rows
}

// The whole board, whatever is filtered — for the masthead.
export async function fetchTotal(): Promise<number> {
  const { count, error } = await supabase.from('listings').select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

/* Every row in `scope`, with just the columns the chips are built from.

   Ordered by id (the primary key, so it is an index scan) because .range()
   over an unordered table is not stable across pages. */
async function sweepFacetRows(scope: FacetScope): Promise<FacetRow[]> {
  const since = cutoffISO(scope.dateRange)

  const { count, error: countError } = await applyScope(
    supabase.from('listings').select('id', { count: 'exact', head: true }),
    scope,
    since,
  )

  if (countError) throw new Error(countError.message)

  const pages = Math.ceil((count ?? 0) / BATCH)

  const chunks = await pool(pages, SWEEP_CONCURRENCY, async (i) => {
    const { data, error } = await applyScope(supabase.from('listings').select(FACET_COLUMNS), scope, since)
      .order('id')
      .range(i * BATCH, i * BATCH + BATCH - 1)

    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as FacetRow[]
  })

  // Trimmed once here, so the chips and the browser-side filtering agree.
  return chunks.flat().map((r) => ({
    country: r.country?.trim() || null,
    ats_source: r.ats_source?.trim() || null,
    keywords_matched: r.keywords_matched,
  }))
}
