import { useState } from 'react';
import { Link } from 'react-router';
import type { SuperadminRestaurantDetailDto } from '@qr-menu/shared';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { apiBlob, errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { openBlob } from '../../../lib/download';
import { displayUrl } from '../../../lib/format';
import { downloads } from '../../../lib/queries';
import { Icon } from '../../icons';
import { LogoTile } from '../../LogoTile';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';
import { Facts, ModuleIcons, planLabel } from '../bits';
import { useOpenAsOwner } from '../useOpenAsOwner';
import { WelcomeEmailModal } from './modals';

/** The finish screen: summary plus the three hand-over actions. */
export function DoneStep({ venue }: { venue: SuperadminRestaurantDetailDto }) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const openAsOwner = useOpenAsOwner();
  const [mailing, setMailing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const owner = venue.members.find((m) => m.role === 'owner');

  const qrSheet = async () => {
    setDownloading(true);
    try {
      const blob = await (venue.tableCount > 0 ? downloads.qrSheet(venue.id) : apiBlob(`/api/admin/restaurants/${venue.id}/qr-card.pdf`));
      openBlob(blob, `qr-${venue.slug}.pdf`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not build the PDF'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 rounded-[10px] border border-line bg-surface p-6 text-center">
        <LogoTile name={venue.name} color={venue.primaryColor} logoUrl={venue.logoUrl} size={64} radius={16} />
        <h2 className="text-xl font-semibold">{venue.name} is set up</h2>
        <p className="max-w-[460px] text-[13px] text-muted">
          <a href={venue.publicUrl} target="_blank" rel="noreferrer" className="font-medium">
            {displayUrl(venue.publicUrl)}
          </a>{' '}
          goes live once the owner (or you) presses Publish in the venue.
        </p>
      </div>
      <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
        <Button variant="primary" size="lg" icon={<Icon name="shield" size={15} strokeWidth={2} />} loading={openAsOwner.pending} onClick={() => void openAsOwner.open(venue.id)}>
          Open as owner
        </Button>
        <Button size="lg" icon={<Icon name="print" size={15} />} loading={downloading} onClick={() => void qrSheet()}>
          {venue.tableCount > 0 ? 'Download QR sheet PDF' : 'Download menu QR PDF'}
        </Button>
        <Button size="lg" icon={<Icon name="mail" size={15} />} disabled={!owner} title={owner ? undefined : 'Add an owner first'} onClick={() => setMailing(true)}>
          Send welcome e-mail
        </Button>
      </div>
      <div className="rounded-[10px] border border-line bg-surface p-5">
        <Facts
          items={[
            { label: 'Owner', value: owner ? `${owner.name} · ${owner.email}` : '—' },
            { label: 'Plan', value: `${venue.status.charAt(0).toUpperCase() + venue.status.slice(1)} · ${planLabel(venue)}` },
            { label: 'Modules', value: <ModuleIcons modules={venue.modules} /> },
            { label: 'Tables', value: String(venue.tableCount) },
            { label: 'Menu', value: `${venue.itemCount} items · ${venue.categoryCount} categories` },
            { label: 'City', value: venue.city ?? '—' },
          ]}
        />
      </div>
      <div className="flex justify-between text-[13px]">
        <Link to={`/admin/restaurants/${venue.id}`} className="font-medium no-underline">
          Venue page
        </Link>
        <Link to="/admin/restaurants" className="font-medium no-underline">
          All restaurants
        </Link>
      </div>
      {mailing ? <WelcomeEmailModal venue={venue} onClose={() => setMailing(false)} /> : null}
    </div>
  );
}
