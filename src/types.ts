// The subset of the `listings` table the website reads + displays.
export interface Listing {
  id: string
  canonical_url: string
  title: string | null
  company_slug: string | null
  keywords_matched: string[]
  snippet: string | null
  first_seen_at: string // ISO timestamptz
}

export type KeywordMode = 'AND' | 'OR'

export interface KeywordCount {
  keyword: string
  count: number
}
