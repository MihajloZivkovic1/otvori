import { useState } from 'react';
import { TABLE_BULK_LIMITS, WELCOME_STEPS_SR, type SuperadminRestaurantDetailDto, type WelcomeEmailResultDto } from '@qr-menu/shared';
import { useAdminRestaurants, useBulkTables, useCopyMenu, useWelcomeEmail } from '../../../lib/admin';
import { errorMessage } from '../../../lib/api';
import { Button } from '../../ui/Button';
import { Field, Input, Select, Textarea } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { Switch } from '../../ui/Switch';
import { useToast } from '../../ui/Toast';
import { CopyButton } from '../bits';

/** Remembers the owner password typed in wizard step 2 (session only) so the finish screen can mail it. */
const ONBOARDING_KEY = (id: string) => `tabla.cms.onboarding.${id}`;
export const onboardingDraft = {
  get(id: string): { ownerPassword: string; ownerEmail: string } | null {
    try {
      const raw = sessionStorage.getItem(ONBOARDING_KEY(id));
      return raw ? (JSON.parse(raw) as { ownerPassword: string; ownerEmail: string }) : null;
    } catch {
      return null;
    }
  },
  set(id: string, value: { ownerPassword: string; ownerEmail: string }): void {
    try {
      sessionStorage.setItem(ONBOARDING_KEY(id), JSON.stringify(value));
    } catch {
      // ignore
    }
  },
  clear(id: string): void {
    try {
      sessionStorage.removeItem(ONBOARDING_KEY(id));
    } catch {
      // ignore
    }
  },
};

/** "Add tables": count + label prefix → POST /tables/bulk. */
export function BulkTablesModal({ restaurantId, existing, onClose, onDone }: { restaurantId: string; existing: number; onClose: () => void; onDone?: (created: number) => void }) {
  const toast = useToast();
  const bulk = useBulkTables(restaurantId);
  const [count, setCount] = useState('12');
  const [prefix, setPrefix] = useState<string>(TABLE_BULK_LIMITS.defaultPrefix);
  const n = Number(count);
  const valid = Number.isInteger(n) && n >= 1 && n <= TABLE_BULK_LIMITS.maxCount && prefix.trim().length > 0;
  return (
    <Modal
      open
      onClose={onClose}
      title="Add tables"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            loading={bulk.isPending}
            onClick={() =>
              bulk.mutate(
                { count: n, prefix: prefix.trim() },
                {
                  onSuccess: (result) => {
                    toast.success(`${result.created} ${result.created === 1 ? 'table' : 'tables'} created`);
                    onDone?.(result.created);
                    onClose();
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            Create {valid ? n : ''} tables
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-ink-2">
        <p>
          {existing > 0 ? `The venue has ${existing} ${existing === 1 ? 'table' : 'tables'}; numbering continues after the highest one.` : 'Each table gets its own QR code; the labels print on the QR sheet.'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="How many" htmlFor="bulk-count">
            <Input id="bulk-count" type="number" inputMode="numeric" min={1} max={TABLE_BULK_LIMITS.maxCount} value={count} onChange={(event) => setCount(event.target.value)} data-autofocus />
          </Field>
          <Field label="Label prefix" htmlFor="bulk-prefix" hint={`e.g. “${prefix.trim() || 'Sto'} 1”, “${prefix.trim() || 'Sto'} 2” …`}>
            <Input id="bulk-prefix" value={prefix} maxLength={30} onChange={(event) => setPrefix(event.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/** "Copy menu from another venue": deep copy of categories, items and variants (no photos). */
export function CopyMenuModal({ restaurantId, onClose, onDone }: { restaurantId: string; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const venues = useAdminRestaurants({ sort: 'name', dir: 'asc', pageSize: 200 });
  const copy = useCopyMenu(restaurantId);
  const [sourceId, setSourceId] = useState('');
  const options = (venues.data?.items ?? []).filter((v) => v.id !== restaurantId && v.itemCount > 0);
  const source = options.find((v) => v.id === sourceId);
  return (
    <Modal
      open
      onClose={onClose}
      title="Copy menu from another venue"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!sourceId}
            loading={copy.isPending}
            onClick={() =>
              copy.mutate(
                { sourceRestaurantId: sourceId },
                {
                  onSuccess: (result) => {
                    toast.success(`${result.items} items in ${result.categories} categories copied`);
                    onDone?.();
                    onClose();
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            Copy {source ? `${source.itemCount} items` : 'menu'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-ink-2">
        <p>Categories, items, prices and variants are copied and appended after what this venue already has. Photos and POS codes are not copied; every copied item starts as available.</p>
        <Field label="Copy from" htmlFor="copy-source">
          <Select id="copy-source" value={sourceId} onChange={(event) => setSourceId(event.target.value)} data-autofocus>
            <option value="">{venues.isPending ? 'Loading venues…' : 'Choose a venue'}</option>
            {options.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name} · {venue.itemCount} items{venue.city ? ` · ${venue.city}` : ''}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

/** "Send welcome e-mail": Serbian mail with login details (password or set-password link), contact and first steps. */
export function WelcomeEmailModal({ venue, onClose }: { venue: SuperadminRestaurantDetailDto; onClose: () => void }) {
  const toast = useToast();
  const send = useWelcomeEmail(venue.id);
  const draft = onboardingDraft.get(venue.id);
  const owners = venue.members.filter((m) => m.role === 'owner' && m.hasRealEmail);
  const [userId, setUserId] = useState(owners[0]?.userId ?? '');
  const [includePassword, setIncludePassword] = useState(Boolean(draft?.ownerPassword));
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<WelcomeEmailResultDto | null>(null);
  const owner = owners.find((o) => o.userId === userId);
  const canIncludePassword = Boolean(draft?.ownerPassword) && draft?.ownerEmail === owner?.email;

  if (sent) {
    return (
      <Modal open onClose={onClose} title="Welcome e-mail sent" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <div className="flex flex-col gap-3 text-sm text-ink-2">
          <p>
            Sent to <strong className="text-ink">{sent.to}</strong>
            {sent.includedPassword ? ' with the password.' : ' with a set-password link (valid 7 days).'} The same text, in case you want to paste it into a chat:
          </p>
          <pre className="max-h-[40dvh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas p-3 font-sans text-[13px] text-ink">{sent.text}</pre>
          <div>
            <CopyButton value={sent.text} label="Copy text" />
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Send welcome e-mail"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!owner}
            loading={send.isPending}
            onClick={() =>
              send.mutate(
                { userId: owner?.userId, ...(includePassword && canIncludePassword ? { password: draft!.ownerPassword } : {}), ...(note.trim() ? { note: note.trim() } : {}) },
                { onSuccess: setSent, onError: (error) => toast.error(errorMessage(error)) },
              )
            }
          >
            Send
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-ink-2">
        {owners.length === 0 ? (
          <p className="text-danger-text">This venue has no owner with a real e-mail address yet — add one under Members first.</p>
        ) : (
          <>
            <Field label="To" htmlFor="welcome-to">
              <Select id="welcome-to" value={userId} onChange={(event) => setUserId(event.target.value)}>
                {owners.map((o) => (
                  <option key={o.userId} value={o.userId}>
                    {o.name} · {o.email}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-line px-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-ink">Include the password I set</span>
                <span className="text-xs text-muted">{canIncludePassword ? 'The password from step 2 of this setup goes into the mail.' : 'Otherwise they get a set-password link valid for 7 days.'}</span>
              </div>
              <Switch label="Include the password I set" checked={includePassword && canIncludePassword} disabled={!canIncludePassword} onChange={setIncludePassword} size="sm" />
            </div>
            <Field label="A line from you (optional)" htmlFor="welcome-note">
              <Textarea id="welcome-note" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Vidimo se u četvrtak u 10 h da prođemo kroz meni." />
            </Field>
            <div className="rounded-lg bg-line-2 p-3 text-xs text-muted">
              The mail is in Serbian: login URL, e-mail, {includePassword && canIncludePassword ? 'the password' : 'the set-password link'}, your name/e-mail/phone, and the first three steps:
              <ol className="mt-1 list-decimal pl-4">
                {WELCOME_STEPS_SR.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
