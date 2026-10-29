import { useState } from 'react';
import { MODULES, PLANS, RESTAURANT_STATUSES, moduleAvailable, superadminUpdateRestaurantSchema, type ModuleKey, type Plan, type RestaurantModules, type RestaurantStatus, type SuperadminRestaurantDetailDto } from '@qr-menu/shared';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useAdminUpdateRestaurant } from '../../../lib/admin';
import { errorMessage } from '../../../lib/api';
import { useAppConfig } from '../../../lib/config';
import { cn } from '../../../lib/cn';
import { useDirtyGuard, useSaveShortcut } from '../../../hooks/useFormGuards';
import { Button } from '../../ui/Button';
import { Field, Input, Select, Textarea } from '../../ui/Field';
import { Switch } from '../../ui/Switch';
import { useToast } from '../../ui/Toast';
import { Card, capitalize } from '../bits';

export const MODULE_COPY: Record<ModuleKey, { label: string; hint: string }> = {
  ordering: { label: 'Ordering', hint: 'Guests order / call the waiter from the menu. Owners can switch this one themselves.' },
  payments: { label: 'Online payment', hint: 'Needs the venue’s bank e-commerce contract (OTP / Monri).' },
  pos: { label: 'POS integration', hint: 'Needs Octopos API access (ESIR or the venue’s own till).' },
};

export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Plan & modules (and the internal notes) — the same fields the wizard's step 3 saves. */
export function PlanTab({ venue }: { venue: SuperadminRestaurantDetailDto }) {
  // Remount on every server change so the local draft starts from the saved values (no state syncing in effects).
  return <PlanForm key={venue.updatedAt} venue={venue} />;
}

function PlanForm({ venue }: { venue: SuperadminRestaurantDetailDto }) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const { features } = useAppConfig();
  const update = useAdminUpdateRestaurant(venue.id);
  const [status, setStatus] = useState<RestaurantStatus>(venue.status);
  const [plan, setPlan] = useState<Plan>(venue.plan);
  const [trialEndsAt, setTrialEndsAt] = useState(toLocalInput(venue.trialEndsAt));
  const [modules, setModules] = useState<RestaurantModules>(venue.modules);
  const [notes, setNotes] = useState(venue.adminNotes ?? '');
  const [error, setError] = useState<string | null>(null);

  const dirty =
    status !== venue.status ||
    plan !== venue.plan ||
    trialEndsAt !== toLocalInput(venue.trialEndsAt) ||
    MODULES.some((key) => modules[key] !== venue.modules[key]) ||
    notes !== (venue.adminNotes ?? '');
  useDirtyGuard(dirty);

  const save = async () => {
    const parsed = superadminUpdateRestaurantSchema.safeParse({
      status,
      plan,
      trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
      modules,
      adminNotes: notes,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid values');
      return;
    }
    setError(null);
    try {
      await update.mutateAsync(parsed.data);
      toast.success(`${venue.name} updated`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  useSaveShortcut(() => dirty && void save());

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-col gap-4"
    >
      <Card title="Plan" description="Suspended venues disappear from the public menu immediately; the trial end only matters while the plan is “trial”.">
        <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
          <Field label="Status" htmlFor="plan-status">
            <Select id="plan-status" value={status} onChange={(event) => setStatus(event.target.value as RestaurantStatus)}>
              {RESTAURANT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {capitalize(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plan" htmlFor="plan-plan">
            <Select id="plan-plan" value={plan} onChange={(event) => setPlan(event.target.value as Plan)}>
              {PLANS.map((value) => (
                <option key={value} value={value}>
                  {capitalize(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trial ends at" htmlFor="plan-trial" hint="Leave empty for no trial end." error={error ?? undefined}>
            <Input id="plan-trial" type="datetime-local" value={trialEndsAt} onChange={(event) => setTrialEndsAt(event.target.value)} />
          </Field>
        </div>
      </Card>
      <Card title="Modules" description="Switch on only what the venue uses and has contracts for.">
        <div className="flex flex-col divide-y divide-line-2">
          {MODULES.map((key) => {
            const available = moduleAvailable(features, key);
            return (
              <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{MODULE_COPY[key].label}</span>
                  <span className="text-xs text-muted">{available ? MODULE_COPY[key].hint : 'Not available yet in this deployment (feature flag off).'}</span>
                </div>
                <Switch label={MODULE_COPY[key].label} checked={available && modules[key]} disabled={!available} onChange={(checked) => setModules({ ...modules, [key]: checked })} />
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Internal notes" description="Contact person, agreements, anything the venue should never see.">
        <Textarea aria-label="Internal notes" rows={4} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Owner prefers Viber; ordering trial agreed until December." />
      </Card>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty} title={dirty ? undefined : 'Nothing changed yet'}>
          Save changes
        </Button>
        <Button
          disabled={!dirty}
          onClick={() => {
            setStatus(venue.status);
            setPlan(venue.plan);
            setTrialEndsAt(toLocalInput(venue.trialEndsAt));
            setModules(venue.modules);
            setNotes(venue.adminNotes ?? '');
          }}
        >
          Reset
        </Button>
        <span className="text-xs text-muted">⌘S saves</span>
      </div>
    </form>
  );
}
