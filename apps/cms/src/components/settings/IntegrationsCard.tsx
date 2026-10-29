import { useId, useState } from 'react';
import { POS_CLOSE_STRATEGIES, POS_LIMITS, POS_MODES, POS_PROVIDERS, type PosCloseStrategy, type PosConfigDto, type PosMode, type PosProviderKey, type TableDto } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useApplyPosSync, usePosConfig, usePosSyncPreview, usePosTables, usePosTaxLabels, useTables, useTestPosConnection, useUpdatePosConfig } from '../../lib/queries';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';
import { PosSyncModal } from './PosSyncModal';

const PROVIDER_LABEL: Record<PosProviderKey, string> = { mock: 'Mock register (development)', octopos: 'Octopos' };

const MODE: Record<PosMode, { title: string; body: string }> = {
  esir: {
    title: 'Octopos issues the fiscal receipts (ESIR)',
    body:
      'No till in the venue. When a guest pays by phone, or staff mark an order as paid in cash, otvori sends the order with its items, prices and payment type to Octopos, which fiscalises it with the Tax Authority and returns the receipt. The guest gets the receipt on their phone as a PDF and by e-mail. Needs a Tax Authority certificate for the venue; Octopos charges per issued receipt.',
  },
  pos: {
    title: 'The venue’s own Octopos till (POS)',
    body:
      'Accepted orders open on the register’s table; an online payment closes them with a fiscal receipt and the till prints it. Rounds the waiter types at the till are paid at the waiter (mixed orders). Octopos has not yet confirmed this mode for production; it works on their sandbox.',
  },
};

const STRATEGY_LABEL: Record<PosCloseStrategy, string> = {
  reissue: 'Cancel the table order and issue the receipt (recommended)',
  pay: 'Pay the open bill on the register (needs a payment type id)',
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
          Fiscal receipts for orders paid through otvori. Failures never block the paid state — the waiter card shows a Retry, and the receipt can
          always be issued at the register by hand.
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
  const connected = Boolean(loaded.provider) && (loaded.provider === 'mock' || loaded.hasApiKey);
  const posTables = usePosTables(restaurantId, connected && loaded.mode === 'pos');
  const taxLabels = usePosTaxLabels(restaurantId, connected);
  const listId = useId();
  const [provider, setProvider] = useState<PosProviderKey | ''>(loaded.provider ?? '');
  const [mode, setMode] = useState<PosMode>(loaded.mode);
  const [baseUrl, setBaseUrl] = useState(loaded.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [taxNumber, setTaxNumber] = useState(loaded.taxNumber ?? '');
  const [taxLabel, setTaxLabel] = useState(loaded.taxLabel);
  const [mapping, setMapping] = useState<Record<string, string>>(loaded.tableMapping);
  const [sendOrders, setSendOrders] = useState(loaded.sendOrdersToPos);
  const [closeOnPayment, setCloseOnPayment] = useState(loaded.closeOnPayment);
  const [closeStrategy, setCloseStrategy] = useState<PosCloseStrategy>(loaded.closeStrategy);
  const [payPaymentTypeId, setPayPaymentTypeId] = useState(loaded.payPaymentTypeId === null ? '' : String(loaded.payPaymentTypeId));
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const cleanMapping = Object.fromEntries(Object.entries(mapping).filter(([, name]) => name.trim() !== '').map(([id, name]) => [id, name.trim()]));
  const payTypeId = payPaymentTypeId.trim() === '' ? null : Number(payPaymentTypeId);
  const effectiveSendOrders = mode === 'pos' && sendOrders;
  const dirty =
    provider !== (loaded.provider ?? '') ||
    mode !== loaded.mode ||
    baseUrl.trim() !== (loaded.baseUrl ?? '') ||
    apiKey !== '' ||
    taxNumber.trim() !== (loaded.taxNumber ?? '') ||
    taxLabel.trim() !== loaded.taxLabel ||
    JSON.stringify(cleanMapping) !== JSON.stringify(loaded.tableMapping) ||
    effectiveSendOrders !== loaded.sendOrdersToPos ||
    closeOnPayment !== loaded.closeOnPayment ||
    closeStrategy !== loaded.closeStrategy ||
    payTypeId !== loaded.payPaymentTypeId;

  const save = () => {
    if (!provider) {
      toast.error('Choose a provider');
      return;
    }
    if (payTypeId !== null && (!Number.isInteger(payTypeId) || payTypeId <= 0)) {
      toast.error('The payment type id must be a whole number');
      return;
    }
    update.mutate(
      {
        provider,
        mode,
        baseUrl: baseUrl.trim() || null,
        ...(apiKey ? { apiKey } : {}),
        taxLabel: taxLabel.trim() || loaded.taxLabel,
        taxNumber: taxNumber.trim() || null,
        tableMapping: cleanMapping,
        sendOrdersToPos: effectiveSendOrders,
        closeOnPayment,
        closeStrategy,
        payPaymentTypeId: payTypeId,
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
  const labels = taxLabels.data ?? [];
  const labelKnown = labels.some((tax) => tax.label === taxLabel);

  return (
    <>
      <div className={cn('grid gap-4 px-5 py-4', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
        <div role="radiogroup" aria-label="Mode" className={cn('grid gap-3 col-span-full', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
          {POS_MODES.map((key) => {
            const active = mode === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(key)}
                className={cn(
                  'flex cursor-pointer flex-col gap-1.5 rounded-[10px] border p-3.5 text-left transition-colors',
                  active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                <span className="text-sm font-semibold">{MODE[key].title}</span>
                <span className="text-[13px] leading-[1.45] text-pretty text-muted">{MODE[key].body}</span>
              </button>
            );
          })}
        </div>
        {mode === 'esir' ? (
          <p className="col-span-full rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-3 text-[13px] text-pretty text-[#78350F]">
            Octopos charges per issued receipt in this mode. Every order paid by phone and every order staff mark as cash becomes one fiscal receipt;
            the price per receipt is in your Octopos contract. See docs/octopos-production.md for the certificate request.
          </p>
        ) : null}
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
        <Field label="Base URL" htmlFor="pos-url" hint="Sandbox: https://sandbox.octopos.rs/api — production URL comes with your token from Octopos.">
          <Input id="pos-url" controlSize={controlSize} value={baseUrl} maxLength={POS_LIMITS.baseUrlMax} onChange={(event) => setBaseUrl(event.target.value)} />
        </Field>
        <Field label="API key" htmlFor="pos-key" hint={loaded.hasApiKey ? 'A key is stored (encrypted). Type a new one to replace it.' : 'The Authorization token Octopos issued for this venue; stored encrypted, never shared between venues.'}>
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
        <Field label="PIB" htmlFor="pos-pib" hint="The venue's tax number, printed in the header of the PDF receipt.">
          <Input id="pos-pib" controlSize={controlSize} inputMode="numeric" value={taxNumber} maxLength={POS_LIMITS.taxNumberMax} onChange={(event) => setTaxNumber(event.target.value)} />
        </Field>
        <Field
          label="Tax label"
          htmlFor="pos-tax"
          hint={
            mode === 'esir'
              ? 'Fiscal VAT label for your items (Ђ = 20 %, Е = 10 % in production). Octopos creates each item under this label the first time it is sold.'
              : 'Fiscal VAT label used when the register has to create an item it does not know.'
          }
        >
          {labels.length > 0 ? (
            <Select id="pos-tax" controlSize={controlSize} value={taxLabel} onChange={(event) => setTaxLabel(event.target.value)}>
              {!labelKnown ? <option value={taxLabel}>{taxLabel}</option> : null}
              {labels.map((tax) => (
                <option key={tax.label} value={tax.label}>
                  {tax.label} · {tax.percent} %
                </option>
              ))}
            </Select>
          ) : (
            <Input id="pos-tax" controlSize={controlSize} value={taxLabel} maxLength={POS_LIMITS.taxLabelMax} onChange={(event) => setTaxLabel(event.target.value)} />
          )}
        </Field>
        <div className={cn('flex flex-col gap-3', !isMobile && 'col-span-full')}>
          {mode === 'pos'
            ? switchRow('Send orders to the register', 'Accepted orders open on the mapped table. Items without a POS code cannot be ordered while this is on.', sendOrders, setSendOrders)
            : null}
          {switchRow(
            'Issue the fiscal receipt on payment',
            mode === 'esir'
              ? 'An online payment, or staff marking the order as cash, sends it to Octopos for fiscalisation (pre-tip amount).'
              : 'An online payment closes the table order with a fiscal receipt (instant payment, pre-tip amount).',
            closeOnPayment,
            setCloseOnPayment,
          )}
        </div>
        {mode === 'pos' ? (
          <>
            <Field label="Closing an opened order" htmlFor="pos-close-strategy" hint="How the paid table order is turned into a fiscal receipt (docs/octopos.md).">
              <Select id="pos-close-strategy" controlSize={controlSize} value={closeStrategy} onChange={(event) => setCloseStrategy(event.target.value as PosCloseStrategy)}>
                {POS_CLOSE_STRATEGIES.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {STRATEGY_LABEL[strategy]}
                  </option>
                ))}
              </Select>
            </Field>
            {closeStrategy === 'pay' ? (
              <Field label="Payment type id" htmlFor="pos-pay-type" hint="Octopos's internal payment type mapped to instant payments on this register (ask Octopos).">
                <Input id="pos-pay-type" controlSize={controlSize} inputMode="numeric" value={payPaymentTypeId} onChange={(event) => setPayPaymentTypeId(event.target.value)} />
              </Field>
            ) : null}
            <fieldset className={cn('flex flex-col gap-2 border-0 p-0', !isMobile && 'col-span-full')}>
              <legend className="mb-1 text-[13px] font-medium">Table mapping</legend>
              <p className="text-[13px] text-muted">
                The register&apos;s table name for each of your tables (unmapped tables use their number).
                {posTables.data ? ` The register has ${posTables.data.length} active tables.` : ''}
              </p>
              {tables.length === 0 ? <p className="text-[13px] text-faint">No tables yet.</p> : null}
              <datalist id={listId}>
                {(posTables.data ?? []).map((table) => (
                  <option key={table.id} value={table.name}>
                    {table.name}
                  </option>
                ))}
              </datalist>
              <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                {tables.map((table) => (
                  <label key={table.id} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate">
                      {table.label} <span className="text-muted">#{table.number}</span>
                    </span>
                    <Input
                      aria-label={`POS table name for ${table.label}`}
                      controlSize="md"
                      list={listId}
                      value={mapping[table.id] ?? ''}
                      placeholder={String(table.number)}
                      maxLength={POS_LIMITS.tableNameMax}
                      onChange={(event) => setMapping({ ...mapping, [table.id]: event.target.value })}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        ) : null}
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
