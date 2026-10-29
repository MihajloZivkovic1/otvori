import { useNavigate } from 'react-router';
import type { SystemStatusDto } from '@qr-menu/shared';
import { Card, Facts, Stat, when } from '../../components/admin/bits';
import { MobileHeader, PageHeader } from '../../components/shell/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusPill } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useRetryPosJob, useSystemStatus } from '../../lib/admin';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** /admin/system — health, build, flags, queues, failed register jobs with retry, mail and storage, counts. */
export function SystemPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const toast = useToast();
  const query = useSystemStatus();
  const retry = useRetryPosJob();
  const status: SystemStatusDto | undefined = query.data;

  return (
    <div className={cn('flex flex-1 flex-col', isMobile ? 'gap-4 pb-8' : 'max-w-[980px] gap-5 p-6')}>
      {isMobile ? (
        <MobileHeader large title="System" />
      ) : (
        <PageHeader
          title="System"
          subtitle="Refreshes every 30 seconds."
          actions={
            <Button size="sm" loading={query.isFetching && !query.isPending} onClick={() => void query.refetch()}>
              Refresh
            </Button>
          }
        />
      )}
      {query.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading system status" className={cn('grid gap-3', isMobile ? 'grid-cols-2 px-4' : 'grid-cols-4')}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : query.isError || !status ? (
        <EmptyState icon="warning" title="Could not load the system status" description={errorMessage(query.error)} actions={<Button onClick={() => void query.refetch()}>Try again</Button>} />
      ) : (
        <div className={cn('flex flex-col gap-4', isMobile && 'px-4')}>
          <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
            <Stat label="Database" value={<StatusPill tone={status.db === 'ok' ? 'success' : 'danger'}>{status.db === 'ok' ? 'Connected' : 'Error'}</StatusPill>} hint={`${status.nodeEnv} · ${status.version}`} />
            <Stat label="Uptime" value={uptime(status.uptimeSeconds)} hint={`since ${when(status.startedAt).toLowerCase()}`} />
            <Stat label="Register queue" value={status.queues.pos.failed > 0 ? <span className="text-danger-text">{status.queues.pos.failed} failed</span> : 'Healthy'} hint={`${status.queues.pos.queued} queued · ${status.queues.pos.running} running · ${status.queues.pos.doneLast24h} done / 24 h`} />
            <Stat label="Payments" value={status.queues.payments.pending} hint={`pending · ${status.queues.payments.paidLast24h} paid / 24 h`} />
          </div>

          <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
            <Card title="Feature flags" description="Global switches of this deployment (env). A module whose flag is off does not exist for anyone.">
              <Facts
                items={[
                  { label: 'Online payment', value: status.features.payments ? 'On' : 'Off' },
                  { label: 'POS integration', value: status.features.pos ? 'On' : 'Off' },
                  { label: 'Payments mock', value: status.mocks.payments ? 'On (simulator)' : 'Off' },
                  { label: 'POS mock', value: status.mocks.pos ? 'On (mock register)' : 'Off' },
                ]}
              />
            </Card>
            <Card title="Mail & storage">
              <Facts
                items={[
                  { label: 'Mail provider', value: status.mail.provider === 'log' ? 'log (messages only go to the server log)' : status.mail.provider },
                  { label: 'Sender', value: status.mail.from },
                  { label: 'Storage', value: status.storage.driver === 's3' ? `S3 · ${status.storage.bucket}` : 'Local uploads folder' },
                ]}
              />
            </Card>
          </div>

          <Card title="Counts">
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
              <Stat label="Venues" value={status.counts.restaurants} hint={`${status.counts.active} active · ${status.counts.trial} trial · ${status.counts.suspended} suspended`} />
              <Stat label="Published" value={status.counts.published} hint={`${status.counts.onboarding} still in setup`} />
              <Stat label="Accounts" value={status.counts.users} />
              <Stat label="Tables · items" value={`${status.counts.tables} · ${status.counts.items}`} />
              <Stat label="Scans today" value={status.counts.scansToday} hint={`${status.counts.scansLast7Days} in 7 days`} />
              <Stat label="Orders today" value={status.counts.ordersToday} hint={`${status.counts.ordersLast7Days} in 7 days`} />
            </div>
          </Card>

          <Card title="Failed register jobs" description="Jobs the queue gave up on (after the retry ladder). Retry re-queues them immediately.">
            {status.failedJobs.length === 0 ? (
              <p className="text-[13px] text-muted">None — every register call went through.</p>
            ) : (
              <ul aria-label="Failed jobs" className="-mx-5 -mb-5 flex flex-col border-t border-line-2">
                {status.failedJobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <button type="button" onClick={() => navigate(`/admin/restaurants/${job.restaurant.id}`)} className="cursor-pointer font-medium text-accent hover:underline">
                          {job.restaurant.name}
                        </button>
                        <span className="text-muted"> · order {job.orderNumber ? `#${job.orderNumber}` : job.orderId.slice(0, 8)} · {job.type.replace('_', ' ')}</span>
                      </div>
                      <div className="truncate font-mono text-xs text-danger-text" title={job.lastError ?? ''}>
                        {job.lastError ?? 'No error message'}
                      </div>
                      <div className="text-xs text-muted">
                        {job.attempts} {job.attempts === 1 ? 'attempt' : 'attempts'} · {when(job.updatedAt)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      loading={retry.isPending && retry.variables === job.id}
                      onClick={() => retry.mutate(job.id, { onSuccess: () => toast.success('Job re-queued'), onError: (error) => toast.error(errorMessage(error)) })}
                    >
                      Retry
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
