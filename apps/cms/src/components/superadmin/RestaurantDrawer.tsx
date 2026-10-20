import { useState } from 'react';
import { PLANS, RESTAURANT_STATUSES, superadminUpdateRestaurantSchema, type Plan, type RestaurantStatus, type SuperadminRestaurantDto } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { useSuperadminUpdateRestaurant } from '../../lib/queries';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { Field, Input, Select } from '../ui/Field';
import { useToast } from '../ui/Toast';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Superadmin support drawer: status, plan and trial end for one venue. */
export function RestaurantDrawer({ restaurant, onClose }: { restaurant: SuperadminRestaurantDto; onClose: () => void }) {
  const toast = useToast();
  const update = useSuperadminUpdateRestaurant();
  const [status, setStatus] = useState<RestaurantStatus>(restaurant.status);
  const [plan, setPlan] = useState<Plan>(restaurant.plan);
  const [trialEndsAt, setTrialEndsAt] = useState(toLocalInput(restaurant.trialEndsAt));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const parsed = superadminUpdateRestaurantSchema.safeParse({
      status,
      plan,
      trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid values');
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ id: restaurant.id, input: parsed.data });
      toast.success(`${restaurant.name} updated`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={restaurant.name}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={update.isPending} onClick={() => void save()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-line-2 px-3 py-2.5 text-[13px]">
          <dt className="text-muted">Slug</dt>
          <dd className="truncate">{restaurant.slug}</dd>
          <dt className="text-muted">Owner</dt>
          <dd className="truncate">{restaurant.owner ? `${restaurant.owner.name} · ${restaurant.owner.email}` : '—'}</dd>
          <dt className="text-muted">Published</dt>
          <dd>{restaurant.publishedAt ? new Date(restaurant.publishedAt).toLocaleDateString('en-GB') : 'Not yet'}</dd>
          <dt className="text-muted">Content</dt>
          <dd>
            {restaurant.tableCount} tables · {restaurant.itemCount} items
          </dd>
        </dl>
        <Field label="Status" htmlFor="sa-status" hint="Suspended venues disappear from the public menu immediately.">
          <Select id="sa-status" value={status} onChange={(event) => setStatus(event.target.value as RestaurantStatus)} data-autofocus>
            {RESTAURANT_STATUSES.map((value) => (
              <option key={value} value={value} className="capitalize">
                {value[0]!.toUpperCase() + value.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plan" htmlFor="sa-plan">
          <Select id="sa-plan" value={plan} onChange={(event) => setPlan(event.target.value as Plan)}>
            {PLANS.map((value) => (
              <option key={value} value={value}>
                {value[0]!.toUpperCase() + value.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Trial ends at" htmlFor="sa-trial" hint="Leave empty for no trial end." error={error ?? undefined}>
          <Input id="sa-trial" type="datetime-local" value={trialEndsAt} onChange={(event) => setTrialEndsAt(event.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}
