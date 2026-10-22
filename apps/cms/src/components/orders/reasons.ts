/**
 * Reject-reason chips. The guest sees the chosen reason verbatim on their phone, so the chips follow the venue's
 * default menu language rather than the (English) admin UI.
 */
export interface RejectReason {
  key: string;
  label: string;
  /** "Other" needs a message; the message alone becomes the reason. */
  needsMessage?: boolean;
}

const REASONS: Record<string, RejectReason[]> = {
  sr: [
    { key: 'stock', label: 'Nema na stanju' },
    { key: 'closed', label: 'Kuhinja je zatvorena' },
    { key: 'table', label: 'Pogrešan sto' },
    { key: 'busy', label: 'Velika gužva, kasnije' },
    { key: 'other', label: 'Drugo', needsMessage: true },
  ],
  en: [
    { key: 'stock', label: 'Out of stock' },
    { key: 'closed', label: 'Kitchen is closed' },
    { key: 'table', label: 'Wrong table' },
    { key: 'busy', label: 'Too busy right now' },
    { key: 'other', label: 'Other', needsMessage: true },
  ],
};

export function rejectReasons(defaultLocale: string): RejectReason[] {
  return REASONS[defaultLocale] ?? REASONS.en!;
}

/** The text stored as `rejectedReason`: chip label, optionally followed by the free-text message. */
export function composeReason(reason: RejectReason, message: string): string {
  const extra = message.trim();
  if (reason.needsMessage) return extra;
  return extra ? `${reason.label} — ${extra}` : reason.label;
}
