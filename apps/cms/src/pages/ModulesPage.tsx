import { MODULES, OWNER_TOGGLABLE_MODULES, moduleAvailable, type ModuleKey } from '@qr-menu/shared';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { StatusPill } from '../components/ui/Chip';
import { Switch } from '../components/ui/Switch';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { useUpdateRestaurant } from '../lib/queries';

const CONTACT = 'zdravo@otvori.menu';

interface ModuleCopy {
  title: string;
  description: string;
  requirements: string;
}

const COPY: Record<ModuleKey, ModuleCopy> = {
  ordering: {
    title: 'Ordering',
    description:
      'Guests call the waiter or send an order straight from the menu; staff handle it on the Orders screen of their phone. No payment — the guest pays the waiter as before.',
    requirements: 'Included in every plan. Pick the mode (calls only, or full ordering) on the Settings page once it is on.',
  },
  payments: {
    title: 'Online payment',
    description:
      'Guests pay an accepted order from their banking app (IPS QR code or a tap into the app). The money goes straight to the venue’s bank account; otvori only creates the payment and receives the confirmation.',
    requirements: 'A merchant e-commerce contract with your bank (OTP eCommerce or Monri WSPay). We set it up together with you.',
  },
  pos: {
    title: 'POS integration',
    description:
      'Fiscal receipts through Octopos for orders paid in otvori. Either Octopos issues them for you (no till needed; the guest gets the receipt as a PDF and by e-mail), or accepted orders open on your own Octopos till and close with a receipt the moment the guest pays online. Menu prices can be synced from the register.',
    requirements:
      'An Octopos account with API access and a token for your venue. Without a till: a Tax Authority certificate for the venue, and Octopos charges per receipt. We set it up together with you and Octopos.',
  },
};

const OWNER_TOGGLABLE: readonly ModuleKey[] = OWNER_TOGGLABLE_MODULES;

/** Settings → Modules (Phase 9b): three cards, one per module, with the owner's switch or the "contact us" path. */
export function ModulesPage() {
  const { restaurant, isOwner, isMobile, features } = useRestaurantContext();
  const toast = useToast();
  const update = useUpdateRestaurant(restaurant.id);

  const toggle = (module: ModuleKey, enabled: boolean) =>
    update.mutate(
      { modules: { [module]: enabled } },
      {
        onSuccess: () => toast.success(`${COPY[module].title} ${enabled ? 'switched on' : 'switched off'}`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  return (
    <div className={cn('flex flex-1 flex-col', isMobile ? 'gap-4 pb-8' : 'max-w-[640px] gap-6 p-6')}>
      {isMobile ? (
        <MobileHeader title="Modules" backTo={`/r/${restaurant.id}/settings`} />
      ) : (
        <PageHeader title="Modules" subtitle="Switch on only what the venue uses; everything else stays out of the way." />
      )}
      <div className={cn('flex flex-col', isMobile ? 'gap-3' : 'gap-4')}>
        {MODULES.map((module) => {
          // Not offered by this deployment yet (global flag off): the API masks it, so `on` is false as well.
          const available = moduleAvailable(features, module);
          const on = available && restaurant.modules[module];
          const ownerToggle = available && OWNER_TOGGLABLE.includes(module);
          const copy = COPY[module];
          const subject = encodeURIComponent(`${copy.title} for ${restaurant.name}`);
          return (
            <section
              key={module}
              aria-labelledby={`module-${module}`}
              className={cn('flex flex-col gap-3 bg-surface p-5', isMobile ? 'border-y border-line' : 'rounded-[10px] border border-line')}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 id={`module-${module}`} className="text-base font-semibold">
                    {copy.title}
                  </h2>
                  <StatusPill tone={on ? 'success' : 'neutral'}>{on ? 'On' : available ? 'Off' : 'Not available yet'}</StatusPill>
                </div>
                {ownerToggle ? (
                  <Switch
                    label={copy.title}
                    checked={on}
                    disabled={!isOwner || update.isPending}
                    size={isMobile ? 'lg' : 'md'}
                    onChange={(checked) => toggle(module, checked)}
                  />
                ) : null}
              </div>
              <p className="text-[14px] leading-relaxed text-ink-2 text-pretty">{copy.description}</p>
              <p className="text-[13px] text-muted text-pretty">
                <span className="font-medium text-ink-2">Requirements: </span>
                {copy.requirements}
              </p>
              {!available ? (
                <p className="text-[13px] text-muted">Not available yet. We will let you know when it opens.</p>
              ) : ownerToggle ? (
                isOwner ? null : (
                  <p className="text-[13px] text-muted">Only owners can switch modules.</p>
                )
              ) : on ? (
                <p className="text-[13px] text-muted">Enabled by otvori. Write to {CONTACT} to change anything about it.</p>
              ) : (
                <a
                  href={`mailto:${CONTACT}?subject=${subject}`}
                  className={cn(
                    'inline-flex w-fit items-center justify-center rounded-lg border border-line bg-surface px-3.5 font-medium text-ink no-underline hover:bg-line-2',
                    isMobile ? 'h-12 text-[15px]' : 'h-9 text-[13px]',
                  )}
                >
                  Contact us to enable
                </a>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
