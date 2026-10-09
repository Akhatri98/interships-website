import type { ChipCount, FacetRow, Facets, KeywordMode } from '../types'

export interface ChipSelection {
  keywords: Set<string>
  mode: KeywordMode
  countries: Set<string>
  atsSources: Set<string>
}

/* The keyword filter applyFilters() sends to the server (ov / cs / not ov),
   replayed on one row. Postgres makes any of those NULL on a NULL array, so a
   listing with no keywords never passes an active keyword filter — not even
   NOT. */
function keywordsPass(
  kws: string[] | null,
  selected: Set<string>,
  wanted: string[],
  mode: KeywordMode,
): boolean {
  if (selected.size === 0) return true
  if (!kws) return false
  if (mode === 'AND') return wanted.every((k) => kws.includes(k))
  const hit = kws.some((k) => selected.has(k))
  return mode === 'NOT' ? !hit : hit
}

// The country and ATS filters: `in (…)`, which a NULL never matches.
function oneOfPass(value: string | null, selected: Set<string>): boolean {
  return selected.size === 0 || (value !== null && selected.has(value))
}

function bump(counts: Map<string, number>, value: string): void {
  counts.set(value, (counts.get(value) ?? 0) + 1)
}

function chips(counts: Map<string, number>): ChipCount[] {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/* Each section counts the listings that pass every OTHER section. Picking a
   country re-counts the keywords and ATS sources, while the country chips keep
   saying what each country holds under the rest of the filters — so they still
   tell you what adding one more would do. A value that nothing passes drops
   out of its section. */
export function countFacets(rows: FacetRow[], sel: ChipSelection): Facets {
  const wanted = [...sel.keywords]
  const keywords = new Map<string, number>()
  const countries = new Map<string, number>()
  const atsSources = new Map<string, number>()

  for (const row of rows) {
    const k = keywordsPass(row.keywords_matched, sel.keywords, wanted, sel.mode)
    const c = oneOfPass(row.country, sel.countries)
    const a = oneOfPass(row.ats_source, sel.atsSources)

    if (c && a) for (const kw of row.keywords_matched ?? []) bump(keywords, kw)
    if (k && a && row.country) bump(countries, row.country)
    if (k && c && row.ats_source) bump(atsSources, row.ats_source)
  }

  return { keywords: chips(keywords), countries: chips(countries), atsSources: chips(atsSources) }
}
