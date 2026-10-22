const RELOAD_FLAG = 'tabla.cms.chunkReload';

/** A lazy chunk that no longer exists on the server: the tab is running a build older than the deployed one. */
export function isStaleChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk/i.test(
    error.message,
  );
}

/**
 * Reloads once when a stale build asks for a chunk that a newer deploy has replaced; the flag prevents a reload loop
 * when the server is genuinely broken.
 */
export function reloadOnceForStaleChunk(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    // Storage blocked: fall through to the error screen rather than risk a loop.
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
