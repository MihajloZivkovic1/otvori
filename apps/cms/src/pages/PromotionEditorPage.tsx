import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PROMOTION_LIMITS, type CreatePromotionInput, type PromotionDto } from '@qr-menu/shared';
import { Icon } from '../components/icons';
import { PromotionPreview } from '../components/promotions/PromotionPreview';
import { TemplatePicker } from '../components/promotions/TemplatePicker';
import { SAMPLES } from '../components/promotions/samples';
import { DISPLAY_META, TEMPLATE_META, draftFromDto, draftToInput, emptyDraft, previewOf, validateDraft, type DraftErrors, type PromotionDraft } from '../components/promotions/draft';
import { DealFields } from '../components/promotions/fields/DealFields';
import { DisplayFields } from '../components/promotions/fields/DisplayFields';
import { DrinkListFields } from '../components/promotions/fields/DrinkListFields';
import { FeaturedItemsFields } from '../components/promotions/fields/FeaturedItemsFields';
import { NoticeFields } from '../components/promotions/fields/NoticeFields';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, Input } from '../components/ui/Field';
import { ConfirmModal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { useDirtyGuard, useSaveShortcut } from '../hooks/useFormGuards';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { useT } from '../lib/i18n';
import { useCreatePromotion, useDeletePromotion, useItems, usePromotions, useUpdatePromotion, useUploadPromotionImage } from '../lib/queries';

type Step = 1 | 2 | 3;
const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: 'Template' },
  { step: 2, label: 'Content' },
  { step: 3, label: 'Display & schedule' },
];

/**
 * Create / edit a promotion in three steps: template (four cards), template-specific content next to a live 390 px
 * phone preview (the same components the guest menu renders), then display mode, accent, priority and schedule.
 */
export function PromotionEditorPage() {
  const { promotionId } = useParams();
  const { restaurant, isOwner, isMobile } = useRestaurantContext();
  const query = usePromotions(restaurant.id);
  const existing = promotionId ? (query.data?.find((promotion) => promotion.id === promotionId) ?? null) : null;

  if (promotionId && query.isPending) {
    return (
      <div className="flex flex-col gap-4 p-6" role="status" aria-busy="true" aria-label="Loading promotion">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (promotionId && !existing) {
    return <EmptyState title="Promotion not found" description="It may have been deleted." />;
  }
  return <Editor key={existing?.id ?? 'new'} existing={existing} restaurantId={restaurant.id} isOwner={isOwner} isMobile={isMobile} />;
}

function Editor({ existing, restaurantId, isOwner, isMobile }: { existing: PromotionDto | null; restaurantId: string; isOwner: boolean; isMobile: boolean }) {
  const { restaurant } = useRestaurantContext();
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const items = useItems(restaurantId);
  const create = useCreatePromotion(restaurantId);
  const update = useUpdatePromotion(restaurantId);
  const remove = useDeletePromotion(restaurantId);
  const upload = useUploadPromotionImage(restaurantId);
  const [draft, setDraft] = useState<PromotionDraft>(() => (existing ? draftFromDto(existing, restaurant) : emptyDraft(restaurant)));
  const [step, setStep] = useState<Step>(existing ? 2 : 1);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [initial] = useState(() => JSON.stringify(draftToInput(draft)));
  const [saved, setSaved] = useState(false);
  const dirty = !saved && JSON.stringify(draftToInput(draft)) !== initial;
  useDirtyGuard(dirty);

  const patch = (next: Partial<PromotionDraft>) => setDraft((prev) => ({ ...prev, ...next }));
  const accent = draft.accentColor ?? restaurant.primaryColor;
  const imageUrl = existing?.imageUrl ?? null;
  // Step 1 previews the sample of the highlighted template; later steps render the unsaved form state.
  const preview = useMemo(
    () => (step === 1 && !existing ? SAMPLES[draft.template] : previewOf(draft, items.data ?? [], restaurant.defaultLocale, imageUrl)),
    [step, existing, draft, items.data, restaurant.defaultLocale, imageUrl],
  );
  const listPath = `/r/${restaurantId}/promotions`;

  useEffect(() => {
    if (saved) navigate(listPath, { replace: true });
  }, [saved, navigate, listPath]);

  const save = async () => {
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      // Jump to the step that owns the first problem.
      const contentFirst = result.errors.content;
      setStep(result.errors.title || contentFirst ? 2 : 3);
      toast.error(result.errors.title ?? contentFirst ?? Object.values(result.errors)[0] ?? 'Check the form');
      return;
    }
    setErrors({});
    const input: CreatePromotionInput = result.input;
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input });
        toast.success('Promotion saved');
      } else {
        await create.mutateAsync(input);
        toast.success('Promotion created');
      }
      setSaved(true);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  useSaveShortcut(() => void save(), isOwner);

  const saving = create.isPending || update.isPending;
  const canNext = step === 1 ? Boolean(draft.template) : step === 2 ? draft.title.trim().length > 0 : false;

  const contentFields = (() => {
    switch (draft.template) {
      case 'drink_list':
        return <DrinkListFields value={draft.drinkList} onChange={(drinkList) => patch({ drinkList })} error={errors.content} />;
      case 'featured_items':
        return <FeaturedItemsFields value={draft.featured} onChange={(featured) => patch({ featured })} error={errors.content} />;
      case 'deal':
        return <DealFields value={draft.deal} onChange={(deal) => patch({ deal })} error={errors.content} />;
      case 'notice':
        return <NoticeFields value={draft.notice} onChange={(notice) => patch({ notice })} error={errors.content} />;
    }
  })();

  const photo =
    draft.template !== 'drink_list' ? (
      <Field label="Photo" hint={existing ? 'Optional, 800×800. Shown above the text.' : 'Save the promotion first, then add a photo.'}>
        {existing ? (
          <div className="flex items-center gap-3">
            {imageUrl ? <img src={imageUrl} alt="" className="size-14 rounded-lg object-cover" /> : <span className="grid size-14 place-items-center rounded-lg bg-line-2 text-faint"><Icon name="image" size={18} /></span>}
            <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-line bg-surface px-3.5 text-[13px] font-medium hover:bg-line-2">
              {upload.isPending ? 'Uploading…' : imageUrl ? 'Replace photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={!isOwner || upload.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.mutate({ id: existing.id, file }, { onSuccess: () => toast.success('Photo uploaded'), onError: (error) => toast.error(errorMessage(error)) });
                  event.target.value = '';
                }}
              />
            </label>
            {imageUrl ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update.mutate({ id: existing.id, input: { imageUrl: null } }, { onError: (error) => toast.error(errorMessage(error)) })}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}
      </Field>
    ) : null;

  const stepper = (
    <ol className="flex flex-wrap items-center gap-1 text-[13px]" aria-label="Steps">
      {STEPS.map(({ step: s, label }, index) => (
        <li key={s} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => (s < step || existing ? setStep(s) : undefined)}
            aria-current={s === step ? 'step' : undefined}
            className={cn('flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium', s === step ? 'bg-accent text-on-accent' : s < step || existing ? 'cursor-pointer text-ink-2 hover:bg-line-2' : 'text-faint')}
          >
            <span className="tabular-nums">{s}</span>
            {label}
          </button>
          {index < STEPS.length - 1 ? <Icon name="chevronRight" size={12} className="text-faint" /> : null}
        </li>
      ))}
    </ol>
  );

  const form = (
    <div className="flex flex-col gap-5">
      {step === 1 ? (
        <TemplatePicker value={draft.template} accent={accent} currency={restaurant.currency} locale={restaurant.defaultLocale} onPick={(template) => patch({ template })} />
      ) : step === 2 ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-[10px] bg-line-2 px-3.5 py-2.5 text-[13px]">
            <span>
              Template: <strong>{TEMPLATE_META[draft.template].name}</strong>
            </span>
            <button type="button" className="cursor-pointer font-medium text-accent" onClick={() => setStep(1)}>
              Change
            </button>
          </div>
          <Field label="Title" htmlFor="promo-title" hint="Shown on the banner / card and as the vertical title of the drink list." error={errors.title}>
            <Input id="promo-title" value={draft.title} maxLength={PROMOTION_LIMITS.titleMax} placeholder="Cocktail Menu" onChange={(event) => patch({ title: event.target.value })} data-autofocus />
          </Field>
          {contentFields}
          {photo}
        </>
      ) : (
        <DisplayFields value={draft} onChange={patch} errors={errors} />
      )}
    </div>
  );

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-2">
        {existing && isOwner ? (
          <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => navigate(listPath)}>{t('Cancel')}</Button>
        {step > 1 ? <Button onClick={() => setStep((step - 1) as Step)}>Back</Button> : null}
        {step < 3 ? (
          <Button variant="primary" disabled={!canNext} onClick={() => setStep((step + 1) as Step)}>
            Next
          </Button>
        ) : (
          <Button variant="primary" loading={saving} disabled={!isOwner} onClick={() => void save()}>
            {existing ? t('Save') : 'Create promotion'}
          </Button>
        )}
      </div>
    </div>
  );

  const previewPanel = (
    <div className="flex flex-col items-center gap-3">
      <PromotionPreview promotion={preview} accent={accent} currency={restaurant.currency} locale={restaurant.defaultLocale} />
      <p className="text-center text-xs text-muted">
        Live preview · shown as <strong>{DISPLAY_META[draft.display].name}</strong>
      </p>
    </div>
  );

  const deleteModal = (
    <ConfirmModal
      open={confirmDelete}
      onClose={() => setConfirmDelete(false)}
      onConfirm={() => {
        if (!existing) return;
        remove.mutate(existing.id, {
          onSuccess: () => {
            setSaved(true);
            toast.success(`“${existing.title}” deleted`);
          },
          onError: (error) => toast.error(errorMessage(error)),
        });
      }}
      title={`Delete “${existing?.title ?? ''}”?`}
      description="Guests stop seeing it immediately. This cannot be undone."
      confirmLabel="Delete promotion"
      danger
      loading={remove.isPending}
    />
  );

  if (isMobile) {
    return (
      <div className="flex flex-1 flex-col">
        <MobileHeader title={existing ? 'Edit promotion' : t('New promotion')} backTo={listPath} />
        <div className="flex flex-col gap-4 px-4 pb-6">
          {stepper}
          {form}
          <button type="button" className="flex h-11 items-center justify-between rounded-[10px] border border-line px-3.5 text-sm font-medium" aria-expanded={previewOpen} onClick={() => setPreviewOpen((v) => !v)}>
            Preview
            <Icon name="chevronDown" size={14} className={cn('transition-transform', previewOpen && 'rotate-180')} />
          </button>
          {previewOpen ? previewPanel : null}
          {footer}
        </div>
        {deleteModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title={existing ? `Edit “${existing.title}”` : t('New promotion')} />
      {stepper}
      <div className="grid items-start gap-6 wide:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-5 rounded-[10px] border border-line bg-surface p-5">
          {form}
          <div className="border-t border-line pt-4">{footer}</div>
        </div>
        <div className="sticky top-6">{previewPanel}</div>
      </div>
      {deleteModal}
    </div>
  );
}
