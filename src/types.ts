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

export type KeywordMode = 'AND' | 'OR'

export interface ChipCount {
  value: string
  count: number
}
