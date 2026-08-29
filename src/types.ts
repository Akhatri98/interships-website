// The subset of the `listings` table the website reads + displays.
export interface Listing {
  id: string
  canonical_url: string
  title: string | null
  company_slug: string | null
  ats_source: string | null // which ATS: greenhouse | lever | ashby | …
  company: string | null // display name; fall back to company_slug when null
  pay: string | null // non-normalized pay signal; usually null
  location: string | null // raw ATS location string, e.g. "London, UK"
  country: string | null // normalized display country, e.g. "United States"
  keywords_matched: string[]
  snippet: string | null
  first_seen_at: string // ISO timestamptz
}

// OR: has any selected keyword. AND: has all of them. NOT: has none of them.
export type KeywordMode = 'OR' | 'AND' | 'NOT'

// How far back to look, against first_seen_at (when we parsed it).
export type DateRange = 'any' | '24h' | '3d' | '7d' | '30d'

export interface ChipCount {
  value: string
  count: number
}

// Everything the server needs to answer one page of the board.
export interface ListingQuery {
  company: string
  text: string // matched against title and snippet
  keywords: string[]
  keywordMode: KeywordMode
  countries: string[]
  atsSources: string[]
  dateRange: DateRange
  page: number // 0-indexed
  pageSize: number
}

export interface ListingPage {
  rows: Listing[]
  total: number // matching rows across every page
}

// Chip vocabularies + counts, swept once and reused for the session.
export interface Facets {
  keywords: ChipCount[]
  countries: ChipCount[]
  atsSources: ChipCount[]
  total: number
}
