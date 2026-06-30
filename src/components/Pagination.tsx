interface Props {
  page: number // 0-indexed
  pageCount: number
  onPage: (page: number) => void
}

export function Pagination({ page, pageCount, onPage }: Props) {
  if (pageCount <= 1) return null

  return (
    <nav className="pagination" aria-label="Pagination">
      <button disabled={page === 0} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>
      <span className="page-status">
        Page {page + 1} of {pageCount}
      </span>
      <button disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </nav>
  )
}
