import { useNavigate } from 'react-router';
import { useMe } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { LogoTile } from '../LogoTile';
import { Badge } from '../ui/Chip';
import { Sheet } from '../ui/Sheet';

/** Mobile venue switcher (bottom sheet) used by Home and More. */
export function VenueSheet({ open, onClose, currentId }: { open: boolean; onClose: () => void; currentId: string }) {
  const me = useMe();
  const navigate = useNavigate();
  return (
    <Sheet open={open} onClose={onClose} title="Your venues" variant="bottom">
      <ul className="flex flex-col gap-0.5 pb-2">
        {me.memberships.map((membership) => {
          const venue = membership.restaurant;
          const active = venue.id === currentId;
          return (
            <li key={membership.id}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/r/${venue.id}`);
                }}
                className={cn('flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-ink', active && 'bg-line-2')}
              >
                <LogoTile name={venue.name} color={venue.primaryColor} logoUrl={venue.logoUrl} size={36} radius={9} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium">{venue.name}</span>
                  <span className="text-xs text-muted">{membership.role === 'owner' ? 'Owner' : 'Staff'}</span>
                </span>
              </button>
            </li>
          );
        })}
        {me.user.isSuperadmin ? (
          <li>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/superadmin');
              }}
              className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-ink"
            >
              All restaurants <Badge className="ml-auto text-ink-2">SUPERADMIN</Badge>
            </button>
          </li>
        ) : null}
      </ul>
    </Sheet>
  );
}
