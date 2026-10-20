import { useState } from 'react';
import { useNavigate } from 'react-router';
import { errorMessage } from '../../lib/api';
import { useAuth, useMe } from '../../lib/auth';
import { useDeleteRestaurant } from '../../lib/queries';
import { lastRestaurant } from '../../lib/storage';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

/** Type-the-name confirmation before DELETE /restaurants/:id (owner only). */
export function DeleteVenueModal({ onClose }: { onClose: () => void }) {
  const { restaurant } = useRestaurantContext();
  const { refreshMe } = useAuth();
  const me = useMe();
  const navigate = useNavigate();
  const toast = useToast();
  const remove = useDeleteRestaurant(restaurant.id);
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === restaurant.name.trim();

  const confirm = async () => {
    if (!matches) return;
    try {
      await remove.mutateAsync();
      lastRestaurant.set(me.user.id, null);
      await refreshMe();
      toast.success(`${restaurant.name} was deleted`);
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete this venue?"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!matches} loading={remove.isPending} onClick={() => void confirm()}>
            Delete venue
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-ink-2">
        <p>
          This permanently removes <strong className="text-ink">{restaurant.name}</strong> — its menu, tables, QR codes and analytics. Printed QR codes stop
          working. This cannot be undone.
        </p>
        <Field label={<>Type <strong>{restaurant.name}</strong> to confirm</>} htmlFor="delete-confirm">
          <Input id="delete-confirm" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" data-autofocus />
        </Field>
      </div>
    </Modal>
  );
}
