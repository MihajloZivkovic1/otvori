import { useState } from 'react';
import { POS_CLOSE_MODES, POS_LIMITS, POS_PROVIDERS, type PosCloseMode, type PosConfigDto, type PosProviderKey, type TableDto } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useApplyPosSync, usePosConfig, usePosSyncPreview, useTables, useTestPosConnection, useUpdatePosConfig } from '../../lib/queries';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';
import { PosSyncModal } from './PosSyncModal';

const PROVIDER_LABEL: Record<PosProviderKey, string> = { mock: 'Mock register (development)', octopos: 'Octopos' };
const CLOSE_MODE_LABEL: Record<PosCloseMode, string> = {
  'reuse-external-id': 'Close the opened order (same ExternalId)',
  'new-receipt': 'Issue a separate receipt (new ExternalId)',
};

/** Settings → "Integrations" (owner, POS module on): the Octopos card. */
export function IntegrationsCard() {
  const { restaurant, isMobile } = useRestaurantContext();
  const config = usePosConfig(restaurant.id);
  const tables = useTables(restaurant.id);
  return (
    <section aria-labelledby="integrations-title" className={cn('flex flex-col bg-surface', isMobile ? 'border-y border-line' : 'rounded-[10px] border border-line')}>
      <div className="flex flex-col gap-1 border-b border-line-2 px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <h2 id="integrations-title" className="text-base font-semibold">
            Integrations · Octopos
          </h2>
          {config.data?.simulator ? (
            <span className="rounded-sm bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold tracking-[.04em] text-[#92400E]" title="POS_MOCK is on: the mock register logs what it would send and returns fake fiscal receipts">
              MOCK REGISTER
            </span>
          ) : null}
        </div>
        <p className="text-[13px] text-pretty text-muted">
          Accepted orders open on the register&apos;s table; an online payment closes them with a fiscal receipt (the pre-tip amount, instant
          payment). Failures never block the paid state — the waiter card shows a Retry.
        </p>
      </div>
      {config.isPending || tables.isPending ? (
        <div className="px-5 py-4 text-[13px] text-muted">Loading…</div>
      ) : config.isError ? (
        <div className="px-5 py-4 text-[13px] text-danger-text">{errorMessage(config.error)}</div>
      ) : (
        <PosForm key={JSON.stringify(config.data)} loaded={config.data} tables={tables.data ?? []} restaurantId={restaurant.id} isMobile={isMobile} />
      )}
    </section>
  );
}

function PosForm({ loaded, tables, restaurantId, isMobile }: { loaded: PosConfigDto; tables: TableDto[]; restaurantId: string; isMobile: boolean }) {
  const toast = useToast();
  const update = useUpdatePosConfig(restaurantId);
  const test = useTestPosConnection(restaurantId);
  const preview = usePosSyncPreview(restaurantId);
  const apply = useApplyPosSync(restaurantId);
  const [provider, setProvider] = useState<PosProviderKey | ''>(loaded.provider ?? '');
  const [baseUrl, setBaseUrl] = useState(loaded.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>(loaded.tableMapping);
  const [sendOrders, setSendOrders] = useState(loaded.sendOrdersToPos);
  const [closeOnPayment, setCloseOnPayment] = useState(loaded.closeOnPayment);
  const [printOnClose, setPrintOnClose] = useState(loaded.printOnClose);
  const [closeMode, setCloseMode] = useState<PosCloseMode>(loaded.closeMode);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const cleanMapping = Object.fromEntries(Object.entries(mapping).filter(([, name]) => name.trim() !== '').map(([id, name]) => [id, name.trim()]));
  const dirty =
    provider !== (loaded.provider ?? '') ||
    baseUrl.trim() !== (loaded.baseUrl ?? '') ||
    apiKey !== '' ||
    JSON.stringify(cleanMapping) !== JSON.stringify(loaded.tableMapping) ||
    sendOrders !== loaded.sendOrdersToPos ||
    closeOnPayment !== loaded.closeOnPayment ||
    printOnClose !== loaded.printOnClose ||
    closeMode !== loaded.closeMode;

  const save = () => {
    if (!provider) {
      toast.error('Choose a provider');
      return;
    }
    update.mutate(
      {
        provider,
        baseUrl: baseUrl.trim() || null,
        ...(apiKey ? { apiKey } : {}),
        tableMapping: cleanMapping,
        sendOrdersToPos: sendOrders,
        closeOnPayment,
        printOnClose,
        closeMode,
      },
      {
        onSuccess: () => toast.success('Integration settings saved'),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  const runTest = () =>
    test.mutate(undefined, {
      onSuccess: (result) => setTestResult(result),
      onError: (error) => setTestResult({ ok: false, message: errorMessage(error) }),
    });

  const openSync = () => {
    setSyncOpen(true);
    preview.mutate(undefined, { onError: (error) => toast.error(errorMessage(error)) });
  };

  const controlSize = isMobile ? 'lg' : 'md';
  const switchRow = (label: string, hint: string, checked: boolean, onChange: (next: boolean) => void) => (
    <div className="flex items-center gap-3.5 rounded-[10px] border border-line p-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[13px] text-pretty text-muted">{hint}</div>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );

  return (
    <>
      <div className={cn('grid gap-4 px-5 py-4', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
        <Field label="Provider" htmlFor="pos-provider">
          <Select id="pos-provider" controlSize={controlSize} value={provider} onChange={(event) => setProvider(event.target.value as PosProviderKey | '')}>
            <option value="">Not set</option>
            {POS_PROVIDERS.map((key) => (
              <option key={key} value={key}>
                {PROVIDER_LABEL[key]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Base URL" htmlFor="pos-url" hint="e.g. https://sandbox.octopos.rs/api">
          <Input id="pos-url" controlSize={controlSize} value={baseUrl} maxLength={POS_LIMITS.baseUrlMax} onChange={(event) => setBaseUrl(event.target.value)} />
        </Field>
        <Field label="API key" htmlFor="pos-key" hint={loaded.hasApiKey ? 'A key is stored (encrypted). Type a new one to replace it.' : 'The Authorization token from Octopos; stored encrypted.'}>
          <Input
            id="pos-key"
            type="password"
            autoComplete="new-password"
            controlSize={controlSize}
            value={apiKey}
            placeholder={loaded.hasApiKey ? '••••••••' : ''}
            maxLength={POS_LIMITS.apiKeyMax}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </Field>
        <Field label="Closing an opened order" htmlFor="pos-close-mode" hint="To be confirmed with Octopos in the sandbox (docs/octopos.md).">
          <Select id="pos-close-mode" controlSize={controlSize} value={closeMode} onChange={(event) => setCloseMode(event.target.value as PosCloseMode)}>
            {POS_CLOSE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {CLOSE_MODE_LABEL[mode]}
              </option>
            ))}
          </Select>
        </Field>
        <div className={cn('flex flex-col gap-3', !isMobile && 'col-span-full')}>
          {switchRow('Send orders to the register', 'Accepted orders open on the mapped table. Items without a POS code cannot be ordered while this is on.', sendOrders, setSendOrders)}
          {switchRow('Close on payment', 'An online payment closes the order with a fiscal receipt (instant payment, pre-tip amount).', closeOnPayment, setCloseOnPayment)}
          {switchRow('Print on close', 'Ask the register to print the receipt (no documented way yet — kept for later).', printOnClose, setPrintOnClose)}
        </div>
        <fieldset className={cn('flex flex-col gap-2 border-0 p-0', !isMobile && 'col-span-full')}>
          <legend className="mb-1 text-[13px] font-medium">Table mapping</legend>
          <p className="text-[13px] text-muted">The register&apos;s table name for each of your tables (unmapped tables use their number).</p>
          {tables.length === 0 ? <p className="text-[13px] text-faint">No tables yet.</p> : null}
          <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
            {tables.map((table) => (
              <label key={table.id} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate">
                  {table.label} <span className="text-muted">#{table.number}</span>
                </span>
                <Input
                  aria-label={`POS table name for ${table.label}`}
                  controlSize="md"
                  value={mapping[table.id] ?? ''}
                  placeholder={String(table.number)}
                  maxLength={POS_LIMITS.tableNameMax}
                  onChange={(event) => setMapping({ ...mapping, [table.id]: event.target.value })}
                />
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line-2 px-5 py-3.5">
        <Button variant="primary" onClick={save} loading={update.isPending} disabled={!dirty}>
          Save
        </Button>
        <Button onClick={runTest} loading={test.isPending} disabled={!loaded.provider}>
          Test connection
        </Button>
        <Button onClick={openSync} disabled={!loaded.provider}>
          Sync products
        </Button>
        {testResult ? (
          <span role="status" className={cn('text-xs', testResult.ok ? 'text-success' : 'text-danger-text')}>
            {testResult.message}
          </span>
        ) : null}
      </div>
      {syncOpen ? (
        <PosSyncModal
          preview={preview.data ?? null}
          loading={preview.isPending}
          applying={apply.isPending}
          onClose={() => setSyncOpen(false)}
          onApply={(input) =>
            apply.mutate(input, {
              onSuccess: (result) => {
                toast.success(`${result.created} new, ${result.updated} price${result.updated === 1 ? '' : 's'} updated`);
                setSyncOpen(false);
              },
              onError: (error) => toast.error(errorMessage(error)),
            })
          }
        />
      ) : null}
    </>
  );
}
