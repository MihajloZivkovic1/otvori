const RELOAD_FLAG = 'tabla.chunkReload';

/** A lazy chunk that a newer deploy has replaced: the guest's tab is running an older build. */
export function isStaleChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk/i.test(
    error.message,
  );
}

/** Reloads once (flag in sessionStorage so a genuinely broken server cannot cause a loop). */
export function reloadOnceForStaleChunk(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function clearStaleChunkFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // ignore
  }
}
