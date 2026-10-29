import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import type { SuperadminRestaurantDetailDto } from '@qr-menu/shared';
import { AdminCrumb } from '../../components/admin/AdminShell';
import { PublishedPill, StatusChip, planLabel } from '../../components/admin/bits';
import { ActivityTab } from '../../components/admin/restaurant/ActivityTab';
import { BillingTab } from '../../components/admin/restaurant/BillingTab';
import { DangerTab } from '../../components/admin/restaurant/DangerTab';
import { MembersTab } from '../../components/admin/restaurant/MembersTab';
import { OverviewTab } from '../../components/admin/restaurant/OverviewTab';
import { PlanTab } from '../../components/admin/restaurant/PlanTab';
import { useOpenAsOwner } from '../../components/admin/useOpenAsOwner';
import { Icon } from '../../components/icons';
import { LogoTile } from '../../components/LogoTile';
import { MobileHeader, PageHeader } from '../../components/shell/PageHeader';
import { FullPageLoading } from '../../components/shell/RequireAuth';
import { Button } from '../../components/ui/Button';
import { Badge, StatusPill } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Menu } from '../../components/ui/Menu';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAdminRestaurant, useAdminUpdateRestaurant } from '../../lib/admin';
import { ApiError, errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';

export const RESTAURANT_TABS = ['overview', 'members', 'plan', 'billing', 'activity', 'danger'] as const;
export type RestaurantTab = (typeof RESTAURANT_TABS)[number];

const TAB_LABELS: Record<RestaurantTab, string> = {
  overview: 'Overview',
  members: 'Members',
  plan: 'Plan & modules',
  billing: 'Billing notes',
  activity: 'Activity',
  danger: 'Danger zone',
};

/** /admin/restaurants/:id/:tab? — one venue as the superadmin sees it. */
export function RestaurantPage() {
  const { id = '', tab: tabParam } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const toast = useToast();
  const tab: RestaurantTab = (RESTAURANT_TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as RestaurantTab) : 'overview';
  const query = useAdminRestaurant(id);
  const update = useAdminUpdateRestaurant(id);
  const openAsOwner = useOpenAsOwner();
  const [suspending, setSuspending] = useState(false);

  useEffect(() => {
    if (query.data) document.title = `${query.data.name} · Superadmin · otvori`;
  }, [query.data]);

  if (tabParam && tab !== tabParam) return <Navigate to={`/admin/restaurants/${id}`} replace />;
  if (query.isPending) return <FullPageLoading label="Loading venue" />;
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <EmptyState
        icon="warning"
        title={gone ? 'This venue no longer exists' : 'Could not load this venue'}
        description={gone ? 'It was deleted, or the link is wrong.' : errorMessage(query.error)}
        actions={
          <>
            <Button onClick={() => navigate('/admin/restaurants')}>Back to restaurants</Button>
            {gone ? null : (
              <Button variant="primary" onClick={() => void query.refetch()}>
                Try again
              </Button>
            )}
          </>
        }
      />
    );
  }
  const venue: SuperadminRestaurantDetailDto = query.data;
  const setTab = (next: RestaurantTab) => navigate(next === 'overview' ? `/admin/restaurants/${id}` : `/admin/restaurants/${id}/${next}`);

  const toggleSuspend = async () => {
    setSuspending(true);
    try {
      const next = venue.status === 'suspended' ? (venue.plan === 'trial' ? 'trial' : 'active') : 'suspended';
      await update.mutateAsync({ status: next });
      toast.success(next === 'suspended' ? `${venue.name} is suspended — its menu is offline` : `${venue.name} is back online`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSuspending(false);
    }
  };

  const chips = (
    <div className="flex flex-wrap items-center gap-2">
      <StatusChip status={venue.status} className="h-7 rounded-md bg-line-2 px-2.5 text-xs text-ink-2" />
      <StatusPill tone={venue.plan === 'trial' ? 'warning' : 'neutral'}>{planLabel(venue)}</StatusPill>
      <PublishedPill publishedAt={venue.publishedAt} status={venue.status} />
      {venue.onboardingStep ? (
        <Link to={`/admin/restaurants/${venue.id}/setup/${venue.onboardingStep}`} className="no-underline">
          <Badge className="bg-accent-soft text-accent">SETUP INCOMPLETE · RESUME STEP {venue.onboardingStep}</Badge>
        </Link>
      ) : null}
    </div>
  );

  const actions = (
    <>
      <Button variant="primary" icon={<Icon name="shield" size={14} strokeWidth={2} />} loading={openAsOwner.pending} onClick={() => void openAsOwner.open(venue.id)} size={isMobile ? 'lg' : 'md'}>
        Open as owner
      </Button>
      {isMobile ? null : (
        <a href={venue.publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-medium text-ink no-underline hover:bg-line-2">
          Public menu <Icon name="external" size={12} />
        </a>
      )}
      <Menu
        items={[
          { label: venue.onboardingStep ? `Resume setup (step ${venue.onboardingStep})` : 'Run the setup wizard again', onSelect: () => navigate(`/admin/restaurants/${venue.id}/setup/${venue.onboardingStep ?? 1}`) },
          { label: 'Copy CMS link', onSelect: () => void navigator.clipboard?.writeText(venue.cmsUrl).then(() => toast.success('CMS link copied')) },
          { label: venue.status === 'suspended' ? 'Reactivate venue' : 'Suspend venue', danger: venue.status !== 'suspended', disabled: suspending, onSelect: () => void toggleSuspend() },
          { label: 'Delete venue…', danger: true, onSelect: () => setTab('danger') },
        ]}
        trigger={(props) => (
          <Button aria-label={`More actions for ${venue.name}`} size={isMobile ? 'lg' : 'md'} {...props}>
            ···
          </Button>
        )}
      />
    </>
  );

  const tabs = RESTAURANT_TABS.map((value) => ({ value, label: TAB_LABELS[value], danger: value === 'danger', ...(value === 'members' ? { count: venue.memberCount } : {}) }));

  return (
    <div className={cn('flex flex-1 flex-col', isMobile ? 'gap-3 pb-8' : 'gap-5 p-6')}>
      <AdminCrumb>{venue.name}</AdminCrumb>
      {isMobile ? (
        <>
          <MobileHeader title={venue.name} backTo="/admin/restaurants" />
          <div className="flex flex-col gap-3 px-4">
            <div className="flex items-center gap-3">
              <LogoTile name={venue.name} color={venue.primaryColor} logoUrl={venue.logoUrl} size={44} radius={11} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-muted">
                  {venue.slug}
                  {venue.city ? ` · ${venue.city}` : ''}
                </div>
                {chips}
              </div>
            </div>
            <div className="flex gap-2">{actions}</div>
          </div>
        </>
      ) : (
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              <LogoTile name={venue.name} color={venue.primaryColor} logoUrl={venue.logoUrl} size={36} radius={9} />
              <span className="flex flex-col gap-1">
                <span>{venue.name}</span>
                <span className="text-[13px] font-normal text-muted">
                  {venue.slug}
                  {venue.city ? ` · ${venue.city}` : ''}
                  {venue.owner ? ` · ${venue.owner.email}` : ''}
                </span>
              </span>
            </span>
          }
          subtitle={chips}
          actions={actions}
        />
      )}
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Venue sections" className={isMobile ? 'px-4' : ''} />
      <div role="tabpanel" aria-label={TAB_LABELS[tab]} className={cn('flex flex-col gap-4', isMobile && 'px-4')}>
        {tab === 'overview' ? <OverviewTab venue={venue} onTab={setTab} /> : null}
        {tab === 'members' ? <MembersTab venue={venue} /> : null}
        {tab === 'plan' ? <PlanTab venue={venue} /> : null}
        {tab === 'billing' ? <BillingTab venue={venue} /> : null}
        {tab === 'activity' ? <ActivityTab venue={venue} /> : null}
        {tab === 'danger' ? <DangerTab venue={venue} /> : null}
      </div>
    </div>
  );
}
