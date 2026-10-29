import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ONBOARDING_STEP_COUNT, type SuperadminCreateRestaurantInput, type SuperadminRestaurantDetailDto, type SuperadminUpdateRestaurantInput } from '@qr-menu/shared';
import { AdminCrumb } from '../../components/admin/AdminShell';
import { DoneStep } from '../../components/admin/onboarding/DoneStep';
import { OwnerStep } from '../../components/admin/onboarding/OwnerStep';
import { PlanStep } from '../../components/admin/onboarding/PlanStep';
import { SetupStep } from '../../components/admin/onboarding/SetupStep';
import { STEP_LABELS, Stepper } from '../../components/admin/onboarding/Stepper';
import { VenueStep } from '../../components/admin/onboarding/VenueStep';
import { MobileHeader, PageHeader } from '../../components/shell/PageHeader';
import { FullPageLoading } from '../../components/shell/RequireAuth';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAdminCreateRestaurant, useAdminRestaurant, useAdminUpdateRestaurant } from '../../lib/admin';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';

const STEP_HINTS = ['Name, address and menu defaults.', 'Who signs in and runs the venue.', 'What they pay for and which modules are on.', 'Tables, logo and the menu itself.'];

/**
 * /admin/restaurants/new and /admin/restaurants/:id/setup/:step — the onboarding wizard (Phase 13b). Every step is
 * saved on the venue (`onboardingStep`), so it can be resumed from the list or the venue page.
 */
export function OnboardingPage() {
  const { id, step: stepParam } = useParams();
  if (!id) return <NewVenue />;
  return <SetupVenue id={id} stepParam={stepParam ?? '2'} />;
}

function Frame({ step, title, venue, children }: { step: number; title: string; venue: SuperadminRestaurantDetailDto | null; children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const done = step > ONBOARDING_STEP_COUNT;
  const go = (next: number) => navigate(venue ? `/admin/restaurants/${venue.id}/setup/${next}` : '/admin/restaurants/new');
  return (
    <div className={cn('flex flex-1 flex-col', isMobile ? 'gap-4 pb-8' : 'max-w-[760px] gap-5 p-6')}>
      <AdminCrumb>{venue ? `${venue.name} · setup` : 'New venue'}</AdminCrumb>
      {isMobile ? (
        <>
          <MobileHeader title={venue?.name ?? 'New venue'} backTo={venue ? `/admin/restaurants/${venue.id}` : '/admin/restaurants'} />
          <div className="px-4">{done ? null : <Stepper current={step} onGo={venue ? go : undefined} />}</div>
        </>
      ) : (
        <PageHeader title={venue ? venue.name : 'New venue'} subtitle={done ? 'Setup finished.' : `Step ${step} of ${ONBOARDING_STEP_COUNT} · ${STEP_HINTS[step - 1]}`} actions={done ? null : <Stepper current={step} onGo={venue ? go : undefined} />} />
      )}
      <section aria-label={title} className={cn('flex flex-col gap-4', isMobile && 'px-4')}>
        {done ? null : <h2 className="text-base font-semibold">{title}</h2>}
        {children}
      </section>
    </div>
  );
}

function NewVenue() {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useAdminCreateRestaurant();
  const [error, setError] = useState<string | null>(null);
  const submit = (input: SuperadminCreateRestaurantInput) => {
    setError(null);
    create.mutate(input, {
      onSuccess: (venue) => {
        toast.success(`${venue.name} created`);
        navigate(`/admin/restaurants/${venue.id}/setup/2`, { replace: true });
      },
      onError: (err) => setError(errorMessage(err)),
    });
  };
  return (
    <Frame step={1} title={STEP_LABELS.venue} venue={null}>
      <VenueStep venue={null} loading={create.isPending} error={error} onSubmit={submit} />
    </Frame>
  );
}

function SetupVenue({ id, stepParam }: { id: string; stepParam: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const query = useAdminRestaurant(id);
  const update = useAdminUpdateRestaurant(id);
  const [error, setError] = useState<string | null>(null);
  const step = stepParam === 'done' ? ONBOARDING_STEP_COUNT + 1 : Number(stepParam);

  if (!Number.isInteger(step) || step < 1 || step > ONBOARDING_STEP_COUNT + 1) return <Navigate to={`/admin/restaurants/${id}/setup/1`} replace />;
  if (query.isPending) return <FullPageLoading label="Loading venue" />;
  if (query.isError) {
    return <EmptyState icon="warning" title="Could not load this venue" description={errorMessage(query.error)} actions={<Button onClick={() => navigate('/admin/restaurants')}>Back to restaurants</Button>} />;
  }
  const venue = query.data;
  const go = (next: number) => navigate(`/admin/restaurants/${id}/setup/${next}`);

  const save = (input: SuperadminUpdateRestaurantInput, next: number | null) => {
    setError(null);
    update.mutate(
      { ...input, onboardingStep: next },
      {
        onSuccess: () => navigate(next ? `/admin/restaurants/${id}/setup/${next}` : `/admin/restaurants/${id}/setup/done`),
        onError: (err) => {
          setError(errorMessage(err));
          toast.error(errorMessage(err));
        },
      },
    );
  };

  if (step === 1) {
    return (
      <Frame step={1} title={STEP_LABELS.venue} venue={venue}>
        <VenueStep venue={venue} loading={update.isPending} error={error} onSubmit={(input) => save(input, Math.max(2, venue.onboardingStep ?? 2))} />
      </Frame>
    );
  }
  if (step === 2) {
    return (
      <Frame step={2} title={STEP_LABELS.owner} venue={venue}>
        <OwnerStep venue={venue} onNext={() => save({}, Math.max(3, venue.onboardingStep ?? 3))} />
      </Frame>
    );
  }
  if (step === 3) {
    return (
      <Frame step={3} title={STEP_LABELS.plan} venue={venue}>
        <PlanStep venue={venue} loading={update.isPending} error={error} onSubmit={(input) => save(input, 4)} />
      </Frame>
    );
  }
  if (step === 4) {
    return (
      <Frame step={4} title={STEP_LABELS.setup} venue={venue}>
        <SetupStep venue={venue} finishing={update.isPending} onFinish={() => save({}, null)} />
      </Frame>
    );
  }
  return (
    <Frame step={step} title="Done" venue={venue}>
      <DoneStep venue={venue} />
      <div className="flex justify-start">
        <Button variant="ghost" size="sm" onClick={() => go(4)}>
          Back to setup
        </Button>
      </div>
    </Frame>
  );
}
