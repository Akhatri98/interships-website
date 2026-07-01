import type { Listing } from '../types'

// Format first_seen_at as date + time in the user's local timezone. Falls back
// to Eastern (EST/EDT) if the runtime can't resolve a system timezone.
function formatSeen(iso: string): string {
  const date = new Date(iso)
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }
  try {
    return date.toLocaleString(undefined, opts)
  } catch {
    return date.toLocaleString('en-US', { ...opts, timeZone: 'America/New_York' })
  }
}

interface Props {
  listing: Listing
  keywords: string[]
  activeKeywords: Set<string>
}

function decodeSlug(slug: string | null): string {
  if (!slug) return ''
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

// Prefer the real display name; fall back to the (decoded) slug when null.
function displayCompany(listing: Listing): string {
  return listing.company?.trim() || decodeSlug(listing.company_slug)
}

// Combine location + country, dropping nulls and avoiding obvious duplication.
function displayLocation(listing: Listing): string {
  const loc = listing.location?.trim()
  const country = listing.country?.trim()
  const parts: string[] = []
  if (loc) parts.push(loc)
  if (country && !(loc && loc.toLowerCase().includes(country.toLowerCase()))) {
    parts.push(country)
  }
  return parts.length ? parts.join(' · ') : 'Location not provided'
}

export function ListingCard({ listing, keywords, activeKeywords }: Props) {
  const { canonical_url, title, pay, first_seen_at } = listing
  const company = displayCompany(listing)
  const location = displayLocation(listing)
  const payLabel = pay?.trim()

  return (
    <article className="card">
      <div className="card-head">
        <a className="card-title" href={canonical_url} target="_blank" rel="noreferrer">
          {title?.trim() || canonical_url}
        </a>
        <time className="card-date" dateTime={first_seen_at}>
          {formatSeen(first_seen_at)}
        </time>
      </div>

      <div className="card-meta">
        {company && <span className="card-company">{company}</span>}
        <span className="card-location">{location}</span>
        {payLabel && <span className="card-pay">{payLabel}</span>}
      </div>

      {listing.snippet?.trim() && <p className="card-snippet">{listing.snippet}</p>}

      <div className="card-keywords">
        {keywords.map((k) => (
          <span key={k} className={`kw ${activeKeywords.has(k) ? 'kw-active' : ''}`}>
            {k}
          </span>
        ))}
      </div>
    </article>
  )
}
