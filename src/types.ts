// The subset of the `listings` table the website reads + displays.
export interface Listing {
  id: string
  canonical_url: string
  title: string | null
  company_slug: string | null
  company: string | null // display name; fall back to company_slug when null
  pay: string | null // non-normalized pay signal; usually null
  location: string | null // raw ATS location string, e.g. "London, UK"
  country: string | null // normalized display country, e.g. "United States"
  keywords_matched: string[]
  snippet: string | null
  first_seen_at: string // ISO timestamptz
}

export type KeywordMode = 'AND' | 'OR'

// 'all' = show everything, 'hide' = drop Unpaid rows, 'only' = keep only Unpaid rows.
export type PayFilter = 'all' | 'hide' | 'only'

// One selectable chip (a keyword label or a country) plus how many listings carry it.
export interface ChipCount {
  value: string
  count: number
}
