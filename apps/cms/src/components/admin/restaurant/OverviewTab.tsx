import { useState } from 'react';
import { Link } from 'react-router';
import type { SuperadminRestaurantDetailDto } from '@qr-menu/shared';
import { apiBlob, errorMessage } from '../../../lib/api';
import { openBlob } from '../../../lib/download';
import { downloads } from '../../../lib/queries';
import { ImportMenuModal } from '../../menu/ImportMenuModal';
import { useToast } from '../../ui/Toast';
import { BulkTablesModal, CopyMenuModal, WelcomeEmailModal } from '../onboarding/modals';
import { displayUrl } from '../../../lib/format';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { cn } from '../../../lib/cn';
import { Icon } from '../../icons';
import { Button } from '../../ui/Button';
import { Card, CopyIcon, Facts, ModuleIcons, Stat, when } from '../bits';
import type { RestaurantTab } from '../../../pages/admin/RestaurantPage';

const LANGUAGE: Record<string, string> = { sr: 'Serbian', en: 'English' };
const ORDERING: Record<string, string> = { off: 'Off (view-only)', call_waiter: 'Call the waiter', order: 'Guests order' };

export function OverviewTab({ venue, onTab }: { venue: SuperadminRestaurantDetailDto; onTab: (tab: RestaurantTab) => void }) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const [action, setAction] = useState<'tables' | 'import' | 'copy' | 'welcome' | null>(null);
  const [downloading, setDownloading] = useState(false);
  const qrSheet = async () => {
    setDownloading(true);
    try {
      openBlob(await (venue.tableCount > 0 ? downloads.qrSheet(venue.id) : apiBlob(`/api/admin/restaurants/${venue.id}/qr-card.pdf`)), `qr-${venue.slug}.pdf`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not build the PDF'));
    } finally {
      setDownloading(false);
    }
  };
  return (
    <>
      {venue.onboardingStep ? (
        <Card
          title="Setup not finished"
          description={`The wizard stopped at step ${venue.onboardingStep} of 4. Everything it does is also available here, or pick up where it left off.`}
          actions={
            <Link to={`/admin/restaurants/${venue.id}/setup/${venue.onboardingStep}`} className="no-underline">
              <Button variant="primary">Resume setup</Button>
            </Link>
          }
          className="border-accent/40 bg-accent-soft"
        />
      ) : null}
      <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
        <Stat label="Tables" value={venue.tableCount} />
        <Stat label="Items" value={venue.itemCount} hint={`${venue.categoryCount} ${venue.categoryCount === 1 ? 'category' : 'categories'}`} />
        <Stat label="Scans · 7 days" value={venue.scansLast7Days} hint={`last scan ${when(venue.lastScanAt).toLowerCase()}`} />
        <Stat label="Orders · 7 days" value={venue.ordersLast7Days} hint={venue.modules.ordering ? ORDERING[venue.orderingMode] : 'ordering off'} />
      </div>
      <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
        <Card title="Links">
          <ul className="flex flex-col gap-2 text-[13px]">
            <li className="flex items-center gap-2">
              <Icon name="globe" size={14} className="shrink-0 text-muted" />
              <a href={venue.publicUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium">
                {displayUrl(venue.publicUrl)}
              </a>
              <CopyIcon value={venue.publicUrl} label="Copy public menu link" />
            </li>
            <li className="flex items-center gap-2">
              <Icon name="settings" size={14} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-ink-2" title={venue.cmsUrl}>
                CMS · {displayUrl(venue.cmsUrl)}
              </span>
              <CopyIcon value={venue.cmsUrl} label="Copy CMS link" />
            </li>
            <li className="flex items-center gap-2">
              <Icon name="orders" size={14} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-ink-2">Modules</span>
              <ModuleIcons modules={venue.modules} />
              <Button size="sm" variant="ghost" onClick={() => onTab('plan')}>
                Change
              </Button>
            </li>
          </ul>
        </Card>
        <Card title="Venue details">
          <Facts
            items={[
              { label: 'Address', value: venue.address ? `${venue.address}${venue.city ? `, ${venue.city}` : ''}` : (venue.city ?? '—') },
              { label: 'Time zone', value: venue.timezone },
              { label: 'Currency', value: venue.currency },
              { label: 'Languages', value: `${venue.supportedLocales.map((l) => LANGUAGE[l] ?? l).join(', ')} · default ${LANGUAGE[venue.defaultLocale] ?? venue.defaultLocale}` },
              { label: 'Tagline', value: venue.tagline ?? '—' },
              { label: 'Menu note', value: venue.menuNote ?? '—' },
              { label: 'Owner PIN', value: venue.pinSet ? 'Set' : 'Not set' },
              { label: 'Created', value: new Date(venue.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
              { label: 'Last edited', value: when(venue.updatedAt) },
            ]}
          />
        </Card>
        <Card title="Owner" actions={<Button size="sm" onClick={() => onTab('members')}>Members</Button>}>
          {venue.owner ? (
            <Facts items={[{ label: 'Name', value: venue.owner.name }, { label: 'E-mail', value: venue.owner.email }, { label: 'Members', value: `${venue.memberCount} ${venue.memberCount === 1 ? 'person' : 'people'}` }]} />
          ) : (
            <p className="text-[13px] text-muted">No owner yet — add one under Members.</p>
          )}
        </Card>
        <Card title="Plan & billing" actions={<Button size="sm" onClick={() => onTab('billing')}>Billing</Button>}>
          <Facts
            items={[
              { label: 'Plan', value: venue.plan.charAt(0).toUpperCase() + venue.plan.slice(1) },
              { label: 'Trial ends', value: venue.trialEndsAt ? new Date(venue.trialEndsAt).toLocaleDateString('en-GB') : '—' },
              { label: 'Paid until', value: venue.paidUntil ? new Date(venue.paidUntil).toLocaleDateString('en-GB') : 'Nothing recorded' },
              { label: 'Billing note', value: venue.billingNote ?? '—' },
            ]}
          />
        </Card>
      </div>
      <Card title="Setup actions" description="Everything the onboarding wizard does, available any time.">
        <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
          <Button icon={<Icon name="tables" size={14} />} onClick={() => setAction('tables')}>
            Add tables
          </Button>
          <Button icon={<Icon name="upload" size={14} />} onClick={() => setAction('import')}>
            Import spreadsheet
          </Button>
          <Button icon={<Icon name="copy" size={14} />} onClick={() => setAction('copy')}>
            Copy menu from…
          </Button>
          <Button icon={<Icon name="print" size={14} />} loading={downloading} onClick={() => void qrSheet()}>
            {venue.tableCount > 0 ? 'QR sheet PDF' : 'Menu QR PDF'}
          </Button>
          <Button icon={<Icon name="mail" size={14} />} disabled={!venue.owner} title={venue.owner ? undefined : 'Add an owner first'} onClick={() => setAction('welcome')}>
            Send welcome e-mail
          </Button>
          <Link to={`/admin/restaurants/${venue.id}/setup/${venue.onboardingStep ?? 1}`} className="no-underline">
            <Button block icon={<Icon name="sparkle" size={14} />}>
              {venue.onboardingStep ? 'Resume wizard' : 'Run the wizard'}
            </Button>
          </Link>
        </div>
      </Card>
      {action === 'tables' ? <BulkTablesModal restaurantId={venue.id} existing={venue.tableCount} onClose={() => setAction(null)} /> : null}
      {action === 'import' ? <ImportMenuModal restaurantId={venue.id} currency={venue.currency} onClose={() => setAction(null)} /> : null}
      {action === 'copy' ? <CopyMenuModal restaurantId={venue.id} onClose={() => setAction(null)} /> : null}
      {action === 'welcome' ? <WelcomeEmailModal venue={venue} onClose={() => setAction(null)} /> : null}
      {venue.adminNotes ? (
        <Card title="Internal notes" actions={<Button size="sm" onClick={() => onTab('plan')}>Edit</Button>}>
          <p className="whitespace-pre-wrap text-[13px] text-ink-2">{venue.adminNotes}</p>
        </Card>
      ) : null}
    </>
  );
}
