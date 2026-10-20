import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { MeDto } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useCreateRestaurant } from '../../lib/queries';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

/** Adding venues is a Pro feature: the user must own at least one venue on the Pro plan (superadmins always may). */
export function canAddVenue(me: MeDto): boolean {
  return me.user.isSuperadmin || me.memberships.some((m) => m.role === 'owner' && m.restaurant.plan === 'pro');
}

/** "+ Add a venue": name → POST /api/admin/restaurants → refresh memberships → open the new, empty menu. */
export function AddVenueModal({ onClose }: { onClose: () => void }) {
  const { refreshMe } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateRestaurant();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim().length >= 2;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) {
      setError('Restaurant name must be at least 2 characters');
      return;
    }
    setError(null);
    try {
      const restaurant = await create.mutateAsync({ name: name.trim() });
      await refreshMe();
      toast.success(`${restaurant.name} was created`);
      onClose();
      navigate(`/r/${restaurant.id}/menu`);
    } catch (err) {
      setError(errorMessage(err, 'Could not create the venue'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a venue"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="add-venue-form" loading={create.isPending} disabled={!valid}>
            Create venue
          </Button>
        </>
      }
    >
      <form id="add-venue-form" onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4 text-sm text-ink-2">
        <p>The new venue gets its own menu, tables, QR codes and analytics, and starts on a 14-day trial. You become its owner.</p>
        <Field label="Restaurant name" htmlFor="add-venue-name" hint="Becomes its menu address, e.g. kafeterija.salveta.menu" error={error ?? undefined}>
          <Input
            id="add-venue-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="organization"
            invalid={Boolean(error)}
            data-autofocus
          />
        </Field>
      </form>
    </Modal>
  );
}
