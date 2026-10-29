import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { PromotionDto } from '@qr-menu/shared';
import { Icon } from '../components/icons';
import { PromotionStatusChip, scheduleSummary } from '../components/promotions/status';
import { DISPLAY_META, TEMPLATE_META } from '../components/promotions/draft';
import { useGuard } from '../components/security/ElevationProvider';
import { LockGlyph } from '../components/security/LockStatus';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { Button, IconButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Menu } from '../components/ui/Menu';
import { ConfirmModal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { Switch } from '../components/ui/Switch';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { useT } from '../lib/i18n';
import { useDeletePromotion, usePromotions, useTogglePromotion } from '../lib/queries';

const GRID = 'grid grid-cols-[1fr_130px_120px_110px_90px_40px] items-center gap-3';

/** Promotions (Phase 14): every promotion with its status, the active switch, edit and delete. */
export function PromotionsPage() {
  const { restaurant, isOwner, isMobile } = useRestaurantContext();
  const { t } = useT();
  const { guard } = useGuard();
  const navigate = useNavigate();
  const toast = useToast();
  const query = usePromotions(restaurant.id);
  const toggle = useTogglePromotion(restaurant.id);
  const remove = useDeletePromotion(restaurant.id);
  const [deleting, setDeleting] = useState<PromotionDto | null>(null);
  const promotions = query.data ?? [];
  const editorPath = (promotion: PromotionDto | 'new') => `/r/${restaurant.id}/promotions/${promotion === 'new' ? 'new' : promotion.id}`;

  const onToggle = (promotion: PromotionDto, isActive: boolean) =>
    toggle.mutate({ id: promotion.id, isActive }, { onError: (error) => toast.error(errorMessage(error)) });

  const confirmDelete = (
    <ConfirmModal
      open={deleting !== null}
      onClose={() => setDeleting(null)}
      onConfirm={() => {
        if (!deleting) return;
        const promotion = deleting;
        setDeleting(null);
        remove.mutate(promotion.id, {
          onSuccess: () => toast.success(`“${promotion.title}” deleted`),
          onError: (error) => toast.error(errorMessage(error)),
        });
      }}
      title={`Delete “${deleting?.title ?? ''}”?`}
      description="Guests stop seeing it immediately. This cannot be undone."
      confirmLabel="Delete promotion"
      danger
      loading={remove.isPending}
    />
  );

  const empty = (
    <EmptyState
      variant="inline"
      icon="megaphone"
      title="No promotions yet."
      description="A cocktail list, a happy hour, tonight's special — shown on the guest menu as a pop-up, a bottom banner or a card."
      actions={isOwner ? <Button size="sm" onClick={guard(() => navigate(editorPath('new')))}>{t('New promotion')}</Button> : undefined}
    />
  );

  if (isMobile) {
    return (
      <div className="flex flex-1 flex-col">
        <MobileHeader
          large
          title={t('Promotions')}
          action={
            isOwner ? (
              <Button variant="accent-text" className="h-11 px-2" icon={<LockGlyph />} onClick={guard(() => navigate(editorPath('new')))}>
                {t('New promotion')}
              </Button>
            ) : null
          }
        />
        <div className="flex-1 border-t border-line-2 bg-surface">
          {query.isPending ? (
            <div role="status" aria-busy="true" aria-label="Loading promotions">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex h-16 items-center gap-3 border-b border-line-2 px-4">
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
              ))}
            </div>
          ) : promotions.length === 0 ? (
            empty
          ) : (
            <ul aria-label="Promotions">
              {promotions.map((promotion) => (
                <li key={promotion.id} className="flex min-h-16 items-center gap-3 border-b border-line-2 px-4 py-2">
                  <Link to={editorPath(promotion)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-ink no-underline">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base font-medium">{promotion.title}</span>
                      <PromotionStatusChip promotion={promotion} />
                    </span>
                    <span className="truncate text-xs text-muted">
                      {TEMPLATE_META[promotion.template].name} · {DISPLAY_META[promotion.display].name} · {scheduleSummary(promotion)}
                    </span>
                  </Link>
                  <Switch checked={promotion.isActive} disabled={!isOwner} onChange={guard((isActive: boolean) => onToggle(promotion, isActive))} label={`Active: ${promotion.title}`} />
                  <Icon name="chevronRight" size={16} strokeWidth={1.8} className="text-muted" />
                </li>
              ))}
            </ul>
          )}
        </div>
        {confirmDelete}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title={t('Promotions')}
        subtitle="Pop-ups, bottom banners and cards on the guest menu — scheduled, recurring or always on."
        actions={
          isOwner ? (
            <Button variant="primary" icon={<LockGlyph />} onClick={guard(() => navigate(editorPath('new')))}>
              {t('New promotion')}
            </Button>
          ) : (
            <span className="text-[13px] text-muted">The owner manages promotions.</span>
          )
        }
      />
      {/* No overflow-hidden here: the row "More" menu pops out below the last row. */}
      <div className="rounded-[10px] border border-line bg-surface">
        <div className={cn(GRID, 'h-9 border-b border-line-2 px-4 text-[11px] font-semibold uppercase tracking-[.06em] text-muted')}>
          <span>Promotion</span>
          <span>Template</span>
          <span>Shown as</span>
          <span>Status</span>
          <span>{t('Active')}</span>
          <span />
        </div>
        {query.isPending ? (
          <div role="status" aria-busy="true" aria-label="Loading promotions">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn(GRID, 'h-[60px] border-b border-line-2 px-4')}>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-10 rounded-full" />
                <span />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState variant="inline" title="Could not load promotions" description={errorMessage(query.error)} actions={<Button size="sm" onClick={() => void query.refetch()}>Try again</Button>} />
        ) : promotions.length === 0 ? (
          empty
        ) : (
          <ul aria-label="Promotions">
            {promotions.map((promotion) => (
              <li key={promotion.id} className={cn(GRID, 'min-h-[60px] border-b border-line-2 px-4 py-2 last:border-b-0')}>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link to={editorPath(promotion)} className="truncate text-sm font-medium text-ink no-underline hover:underline">
                    {promotion.title}
                  </Link>
                  <span className="truncate text-xs text-muted">{scheduleSummary(promotion)}</span>
                </div>
                <span className="text-[13px]">{TEMPLATE_META[promotion.template].name}</span>
                <span className="text-[13px]">{DISPLAY_META[promotion.display].name}</span>
                <PromotionStatusChip promotion={promotion} />
                <Switch checked={promotion.isActive} disabled={!isOwner} onChange={guard((isActive: boolean) => onToggle(promotion, isActive))} label={`Active: ${promotion.title}`} />
                <Menu
                  items={[
                    { label: 'Edit', onSelect: guard(() => navigate(editorPath(promotion))) },
                    ...(isOwner ? [{ label: 'Delete', onSelect: guard(() => setDeleting(promotion)), danger: true }] : []),
                  ]}
                  trigger={(props) => (
                    <IconButton label={`More actions for ${promotion.title}`} {...props}>
                      <Icon name="more" size={16} />
                    </IconButton>
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {confirmDelete}
    </div>
  );
}
