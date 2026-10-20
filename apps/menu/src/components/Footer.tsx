export function Footer() {
  return (
    <footer className="px-5 pt-9 pb-5 text-center text-xs text-muted">
      Powered by{' '}
      <a href="https://salveta.menu" rel="noreferrer" className="inline-flex items-center gap-1 align-middle font-serif font-bold text-ink no-underline">
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 3h12.5L21 8.5V21H3z" fill="currentColor" />
          <path d="M15.5 3v5.5H21z" fill="currentColor" opacity=".45" />
        </svg>
        salveta
      </a>
    </footer>
  );
}
