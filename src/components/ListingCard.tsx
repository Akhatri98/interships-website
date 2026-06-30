import type { Listing } from '../types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

export function ListingCard({ listing, keywords, activeKeywords }: Props) {
  const { canonical_url, title, company_slug, snippet, first_seen_at } = listing
  const displaySlug = decodeSlug(company_slug)

  return (
    <article className="card">
      <div className="card-head">
        <a className="card-title" href={canonical_url} target="_blank" rel="noreferrer">
          {title?.trim() || canonical_url}
        </a>
        <time className="card-date" dateTime={first_seen_at}>
          {formatDate(first_seen_at)}
        </time>
      </div>

      {displaySlug && <div className="card-slug">{displaySlug}</div>}

      {snippet?.trim() && <p className="card-snippet">{snippet}</p>}

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
