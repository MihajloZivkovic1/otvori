import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { SuperadminRestaurantDetailDto } from '@qr-menu/shared';
import { useAdminDeleteRestaurant, useAdminUpdateRestaurant } from '../../../lib/admin';
import { errorMessage } from '../../../lib/api';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { Card } from '../bits';

export function DangerTab({ venue }: { venue: SuperadminRestaurantDetailDto }) {
  const navigate = useNavigate();
  const toast = useToast();
  const update = useAdminUpdateRestaurant(venue.id);
  const remove = useAdminDeleteRestaurant();
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === venue.name.trim();
  const suspended = venue.status === 'suspended';

  const toggle = () =>
    update.mutate(
      { status: suspended ? (venue.plan === 'trial' ? 'trial' : 'active') : 'suspended' },
      {
        onSuccess: (next) => toast.success(next.status === 'suspended' ? `${venue.name} is suspended — its menu is offline` : `${venue.name} is back online`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const confirmDelete = async () => {
    if (!matches) return;
    try {
      await remove.mutateAsync(venue.id);
      toast.success(`${venue.name} was deleted`);
      navigate('/admin/restaurants', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <Card
        danger
        title={suspended ? 'Reactivate this venue' : 'Suspend this venue'}
        description={suspended ? 'The public menu comes back the moment you reactivate; nothing was deleted.' : 'The public menu goes offline immediately (guests see “not available”). The owner keeps their sign-in and data; you can reactivate at any time.'}
        actions={
          <Button variant={suspended ? 'primary' : 'danger'} loading={update.isPending} onClick={toggle}>
            {suspended ? 'Reactivate' : 'Suspend'}
          </Button>
        }
      />
      <Card
        danger
        title="Delete this venue"
        description="Removes the menu, tables, QR codes, orders, members’ access and analytics. Printed QR codes stop working. This cannot be undone."
        actions={
          <Button variant="danger" onClick={() => setDeleting(true)}>
            Delete venue…
          </Button>
        }
      />
      {deleting ? (
        <Modal
          open
          onClose={() => setDeleting(false)}
          title={`Delete ${venue.name}?`}
          footer={
            <>
              <Button onClick={() => setDeleting(false)}>Cancel</Button>
              <Button variant="danger-solid" disabled={!matches} loading={remove.isPending} onClick={() => void confirmDelete()}>
                Delete {venue.name}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4 text-sm text-ink-2">
            <p>
              This permanently removes <strong className="text-ink">{venue.name}</strong> ({venue.slug}) — {venue.itemCount} items, {venue.tableCount} tables, every order and the change history. The {venue.memberCount}{' '}
              {venue.memberCount === 1 ? 'member keeps' : 'members keep'} their accounts.
            </p>
            <Field label={<>Type <strong>{venue.name}</strong> to confirm</>} htmlFor="admin-delete-confirm">
              <Input id="admin-delete-confirm" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" data-autofocus />
            </Field>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
