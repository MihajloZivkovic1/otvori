import { useState } from 'react';
import type { SuperadminRestaurantDetailDto } from '@qr-menu/shared';
import { useDirtyGuard, useSaveShortcut } from '../../../hooks/useFormGuards';
import { useNow } from '../../../hooks/useNow';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useAdminUpdateRestaurant } from '../../../lib/admin';
import { errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { Button } from '../../ui/Button';
import { Field, Input, Textarea } from '../../ui/Field';
import { useToast } from '../../ui/Toast';
import { Card, planLabel } from '../bits';

/** Billing notes for manual invoicing: free text + "paid until". */
export function BillingTab({ venue }: { venue: SuperadminRestaurantDetailDto }) {
  return <BillingForm key={venue.updatedAt} venue={venue} />;
}

function BillingForm({ venue }: { venue: SuperadminRestaurantDetailDto }) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const update = useAdminUpdateRestaurant(venue.id);
  const [note, setNote] = useState(venue.billingNote ?? '');
  const [paidUntil, setPaidUntil] = useState(venue.paidUntil ?? '');
  const now = useNow(60_000);

  const dirty = note !== (venue.billingNote ?? '') || paidUntil !== (venue.paidUntil ?? '');
  useDirtyGuard(dirty);

  const save = async () => {
    try {
      await update.mutateAsync({ billingNote: note, paidUntil: paidUntil || null });
      toast.success('Billing notes saved');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  useSaveShortcut(() => dirty && void save());

  const overdue = venue.paidUntil ? new Date(venue.paidUntil).getTime() < now.getTime() : false;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-col gap-4"
    >
      <Card title="Billing notes" description={`Invoices are sent by hand for now. Current plan: ${planLabel(venue)}.`}>
        <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[200px_1fr]')}>
          <Field label="Paid until" htmlFor="billing-paid" hint={overdue ? 'This date has passed.' : 'Leave empty when nothing was invoiced yet.'}>
            <Input id="billing-paid" type="date" value={paidUntil} onChange={(event) => setPaidUntil(event.target.value)} invalid={overdue || undefined} />
          </Field>
          <Field label="Notes" htmlFor="billing-note" hint="Who pays, how, invoice details, discounts.">
            <Textarea id="billing-note" rows={5} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Yearly Pro, invoice to Kafeterija d.o.o., PIB 123456789, paid by bank transfer." />
          </Field>
        </div>
      </Card>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty} title={dirty ? undefined : 'Nothing changed yet'}>
          Save notes
        </Button>
        <Button
          disabled={!dirty}
          onClick={() => {
            setNote(venue.billingNote ?? '');
            setPaidUntil(venue.paidUntil ?? '');
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
