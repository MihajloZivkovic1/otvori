/** Save a Blob through a temporary <a download>. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Open a Blob (the QR PDF) in a new tab, falling back to a download when pop-ups are blocked. */
export function openBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener');
  if (!opened) downloadBlob(blob, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
