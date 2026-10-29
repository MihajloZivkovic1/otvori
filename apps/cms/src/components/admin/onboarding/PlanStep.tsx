import { useState, type FormEvent } from 'react';
import { MODULES, PLANS, RESTAURANT_STATUSES, moduleAvailable, superadminUpdateRestaurantSchema, type Plan, type RestaurantModules, type RestaurantStatus, type SuperadminRestaurantDetailDto, type SuperadminUpdateRestaurantInput } from '@qr-menu/shared';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useAppConfig } from '../../../lib/config';
import { cn } from '../../../lib/cn';
import { Button } from '../../ui/Button';
import { Field, Input, Select, Textarea } from '../../ui/Field';
import { Switch } from '../../ui/Switch';
import { capitalize } from '../bits';
import { MODULE_COPY, toLocalInput } from '../restaurant/PlanTab';

function plusDays(days: number): string {
  return toLocalInput(new Date(Date.now() + days * 86_400_000).toISOString());
}

/** Step 3: status, plan, trial end (default +14 days), modules, billing note and "paid until". */
export function PlanStep({ venue, loading, error, onSubmit }: { venue: SuperadminRestaurantDetailDto; loading?: boolean; error?: string | null; onSubmit: (input: SuperadminUpdateRestaurantInput) => void }) {
  const isMobile = useIsMobile();
  const { features } = useAppConfig();
  const [status, setStatus] = useState<RestaurantStatus>(venue.status);
  const [plan, setPlan] = useState<Plan>(venue.plan);
  const [trialEndsAt, setTrialEndsAt] = useState(venue.trialEndsAt ? toLocalInput(venue.trialEndsAt) : plusDays(14));
  const [modules, setModules] = useState<RestaurantModules>(venue.modules);
  const [billingNote, setBillingNote] = useState(venue.billingNote ?? '');
  const [paidUntil, setPaidUntil] = useState(venue.paidUntil ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = superadminUpdateRestaurantSchema.safeParse({
      status,
      plan,
      trialEndsAt: plan === 'trial' && trialEndsAt ? new Date(trialEndsAt).toISOString() : plan === 'trial' ? null : venue.trialEndsAt,
      modules,
      billingNote: billingNote.trim() || null,
      paidUntil: paidUntil || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Invalid values');
      return;
    }
    setFormError(null);
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" aria-label="Plan">
      <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
        <Field label="Status" htmlFor="p-status" hint="Trial venues work exactly like active ones until the trial ends.">
          <Select id="p-status" value={status} onChange={(event) => setStatus(event.target.value as RestaurantStatus)} data-autofocus>
            {RESTAURANT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {capitalize(value)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plan" htmlFor="p-plan">
          <Select id="p-plan" value={plan} onChange={(event) => setPlan(event.target.value as Plan)}>
            {PLANS.map((value) => (
              <option key={value} value={value}>
                {capitalize(value)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Trial ends" htmlFor="p-trial" hint={plan === 'trial' ? 'Default: 14 days from today.' : 'Only used while the plan is “trial”.'}>
          <Input id="p-trial" type="datetime-local" value={trialEndsAt} onChange={(event) => setTrialEndsAt(event.target.value)} disabled={plan !== 'trial'} />
        </Field>
      </div>
      <fieldset className="flex flex-col divide-y divide-line-2 rounded-[10px] border border-line bg-surface px-4">
        <legend className="sr-only">Modules</legend>
        {MODULES.map((key) => {
          const available = moduleAvailable(features, key);
          return (
            <div key={key} className="flex items-center justify-between gap-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{MODULE_COPY[key].label}</span>
                <span className="text-xs text-muted">{available ? MODULE_COPY[key].hint : 'Not available yet in this deployment.'}</span>
              </div>
              <Switch label={MODULE_COPY[key].label} checked={available && modules[key]} disabled={!available} onChange={(checked) => setModules({ ...modules, [key]: checked })} />
            </div>
          );
        })}
      </fieldset>
      <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[200px_1fr]')}>
        <Field label="Paid until" htmlFor="p-paid" hint="Manual invoicing; leave empty if nothing was invoiced.">
          <Input id="p-paid" type="date" value={paidUntil} onChange={(event) => setPaidUntil(event.target.value)} />
        </Field>
        <Field label="Billing note" htmlFor="p-billing" hint="Who pays, how, invoice details.">
          <Textarea id="p-billing" rows={3} maxLength={2000} value={billingNote} onChange={(event) => setBillingNote(event.target.value)} />
        </Field>
      </div>
      {formError || error ? (
        <p role="alert" className="text-[13px] text-danger-text">
          {formError ?? error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size={isMobile ? 'lg' : 'md'} loading={loading}>
          Save and continue
        </Button>
      </div>
    </form>
  );
}
