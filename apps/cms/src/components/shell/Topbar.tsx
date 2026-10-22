import type { MembershipRole, RestaurantDto } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { usePublishRestaurant } from '../../lib/queries';
import { screenTitle, useScreen } from '../../lib/screens';
import { Icon } from '../icons';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/Chip';
import { useToast } from '../ui/Toast';

interface TopbarProps {
  restaurant: RestaurantDto | null;
  role: MembershipRole;
  title?: string;
}

export function Topbar({ restaurant, role, title }: TopbarProps) {
  const screen = useScreen();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
        <span className="truncate">{restaurant?.name ?? 'otvori'}</span>
        <span className="text-line-strong" aria-hidden="true">
          /
        </span>
        <span className="truncate font-semibold text-ink">{title ?? screenTitle(screen)}</span>
      </nav>
      {restaurant ? <PublishControls restaurant={restaurant} role={role} /> : null}
    </header>
  );
}

export function PublishControls({ restaurant, role }: { restaurant: RestaurantDto; role: MembershipRole }) {
  const publish = usePublishRestaurant(restaurant.id);
  const toast = useToast();
  const suspended = restaurant.status === 'suspended';

  return (
    <div className="flex items-center gap-2">
      {suspended ? (
        <StatusPill tone="danger">Suspended</StatusPill>
      ) : restaurant.publishedAt ? (
        <StatusPill tone="success">Published</StatusPill>
      ) : (
        <>
          <StatusPill tone="warning">Unpublished</StatusPill>
          {role === 'owner' ? (
            <Button
              variant="primary"
              size="sm"
              loading={publish.isPending}
              onClick={() =>
                publish.mutate(undefined, {
                  onSuccess: () => toast.success('Menu published — guests can scan it now'),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              Publish
            </Button>
          ) : null}
        </>
      )}
      <a
        href={restaurant.publicUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink no-underline hover:bg-line-2"
      >
        View live menu <Icon name="external" size={12} />
      </a>
    </div>
  );
}
