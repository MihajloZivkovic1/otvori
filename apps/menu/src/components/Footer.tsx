export function Footer() {
  return (
    <footer className="px-5 pt-9 pb-5 text-center text-xs text-muted">
      Powered by{' '}
      <a href="https://otvori.menu" rel="noreferrer" className="inline-flex items-center gap-1 align-middle font-serif text-ink no-underline">
        <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path d="M23 6H9a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
          <rect x="11.3" y="12" width="8" height="8" rx="1.5" fill="currentColor" />
          <path d="M24.5 6.4 30 2.2v27.6l-5.5-4.2z" fill="currentColor" />
        </svg>
        otvori
      </a>
    </footer>
  );
}
