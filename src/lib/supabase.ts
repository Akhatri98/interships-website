import { createClient } from '@supabase/supabase-js'
import type { Listing } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Add them to .env.local (must be VITE_-prefixed for Vite to expose them).',
  )
}

export const supabase = createClient(url, anonKey)

// Only these columns are needed by the UI.
const COLUMNS = 'id, canonical_url, title, company_slug, keywords_matched, snippet, first_seen_at'

// PostgREST caps a single response (default 1000 rows), so page through with
// .range() until a short page comes back. Sorted newest-first at the source.
const BATCH = 1000

export async function fetchAllListings(): Promise<Listing[]> {
  const all: Listing[] = []
  let from = 0

  for (; ;) {
    const { data, error } = await supabase
      .from('listings')
      .select(COLUMNS)
      .order('first_seen_at', { ascending: false })
      .range(from, from + BATCH - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    all.push(...(data as Listing[]))
    if (data.length < BATCH) break
    from += BATCH
  }

  return all
}
