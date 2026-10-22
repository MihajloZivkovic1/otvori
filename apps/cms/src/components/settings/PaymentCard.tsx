import { useState } from 'react';
import { PAYMENT_LIMITS, PAYMENT_PROVIDERS, type PaymentConfigDto, type PaymentProviderKey } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { usePaymentConfig, useTestPaymentConnection, useUpdatePaymentConfig } from '../../lib/queries';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';

const PROVIDER_LABEL: Record<PaymentProviderKey, string> = {
  mock: 'Simulator (development)',
  otp: 'OTP eCommerce (IPS)',
};

function parsePresets(value: string): number[] | null {
  const parts = value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const numbers = parts.map(Number);
  if (numbers.some((n) => !Number.isInteger(n) || n < 0 || n > PAYMENT_LIMITS.tipPercentMax)) return null;
  return [...new Set([0, ...numbers])].sort((a, b) => a - b).slice(0, PAYMENT_LIMITS.tipPresetsMax);
}

/** Settings → "Payment" (owner, payments module on): provider, merchant credentials, tips, receipt mail, connection test. */
export function PaymentCard() {
  const { restaurant, isMobile } = useRestaurantContext();
  const config = usePaymentConfig(restaurant.id);
  return (
    <section aria-labelledby="payment-title" className={cn('flex flex-col bg-surface', isMobile ? 'border-y border-line' : 'rounded-[10px] border border-line')}>
      <div className="flex flex-col gap-1 border-b border-line-2 px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <h2 id="payment-title" className="text-base font-semibold">
            Payment
          </h2>
          {config.data?.simulator ? (
            <span className="rounded-sm bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold tracking-[.04em] text-[#92400E]" title="PAYMENTS_MOCK is on: payments go through the simulator page, not a bank">
              SIMULATOR
            </span>
          ) : null}
        </div>
        <p className="text-[13px] text-pretty text-muted">
          Guests pay accepted orders from their banking app (IPS). The money goes to the venue&apos;s account under its merchant contract; otvori
          only creates the payment and receives the bank&apos;s confirmation.
        </p>
      </div>
      {config.isPending ? (
        <div className="px-5 py-4 text-[13px] text-muted">Loading…</div>
      ) : config.isError ? (
        <div className="px-5 py-4 text-[13px] text-danger-text">{errorMessage(config.error)}</div>
      ) : (
        // Keyed on the saved config: a save remounts the form with fresh defaults (and an empty secret field).
        <PaymentForm key={JSON.stringify(config.data)} loaded={config.data} restaurantId={restaurant.id} isMobile={isMobile} />
      )}
    </section>
  );
}

function PaymentForm({ loaded, restaurantId, isMobile }: { loaded: PaymentConfigDto; restaurantId: string; isMobile: boolean }) {
  const toast = useToast();
  const update = useUpdatePaymentConfig(restaurantId);
  const test = useTestPaymentConnection(restaurantId);
  const [provider, setProvider] = useState<PaymentProviderKey | ''>(loaded.provider ?? '');
  const [merchantId, setMerchantId] = useState(loaded.merchantId ?? '');
  const [secret, setSecret] = useState('');
  const [presets, setPresets] = useState(loaded.tipPresets.filter((p) => p > 0).join(', '));
  const [receipt, setReceipt] = useState(loaded.receiptEmailEnabled);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const presetList = parsePresets(presets);
  const dirty =
    provider !== (loaded.provider ?? '') ||
    merchantId.trim() !== (loaded.merchantId ?? '') ||
    secret !== '' ||
    JSON.stringify(presetList) !== JSON.stringify(loaded.tipPresets) ||
    receipt !== loaded.receiptEmailEnabled;

  const save = () => {
    if (!provider) {
      toast.error('Choose a provider');
      return;
    }
    if (!presetList) {
      toast.error(`Tip presets must be whole percentages between 0 and ${PAYMENT_LIMITS.tipPercentMax}`);
      return;
    }
    update.mutate(
      {
        provider,
        merchantId: merchantId.trim() || null,
        ...(secret ? { secret } : {}),
        tipPresets: presetList,
        receiptEmailEnabled: receipt,
      },
      {
        onSuccess: () => toast.success('Payment settings saved'),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  const runTest = () =>
    test.mutate(undefined, {
      onSuccess: (result) => setTestResult(result),
      onError: (error) => setTestResult({ ok: false, message: errorMessage(error) }),
    });

  const controlSize = isMobile ? 'lg' : 'md';

  return (
    <>
      <div className={cn('grid gap-4 px-5 py-4', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
        <Field label="Provider" htmlFor="pay-provider" hint="The bank gateway the venue has a contract with.">
          <Select id="pay-provider" controlSize={controlSize} value={provider} onChange={(event) => setProvider(event.target.value as PaymentProviderKey | '')}>
            <option value="">Not set</option>
            {PAYMENT_PROVIDERS.map((key) => (
              <option key={key} value={key}>
                {PROVIDER_LABEL[key]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Merchant ID" htmlFor="pay-merchant">
          <Input id="pay-merchant" controlSize={controlSize} value={merchantId} maxLength={PAYMENT_LIMITS.merchantIdMax} onChange={(event) => setMerchantId(event.target.value)} />
        </Field>
        <Field
          label="Secret"
          htmlFor="pay-secret"
          hint={loaded.hasSecret ? 'A secret is stored (encrypted). Type a new one to replace it.' : 'API key / signing secret from the bank; stored encrypted, never shown again.'}
        >
          <Input
            id="pay-secret"
            type="password"
            autoComplete="new-password"
            controlSize={controlSize}
            value={secret}
            placeholder={loaded.hasSecret ? '••••••••' : ''}
            maxLength={PAYMENT_LIMITS.secretMax}
            onChange={(event) => setSecret(event.target.value)}
          />
        </Field>
        <Field label="Tip presets (%)" htmlFor="pay-tips" hint='Offered to the guest as chips; "no tip" is always first.'>
          <Input id="pay-tips" controlSize={controlSize} value={presets} placeholder="5, 10, 15" invalid={presetList === null} onChange={(event) => setPresets(event.target.value)} />
        </Field>
        <div className={cn('flex items-center gap-3.5 rounded-[10px] border border-line p-3.5', !isMobile && 'col-span-full')}>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">E-mail the fiscal receipt</div>
            <div className="text-[13px] text-pretty text-muted">After an online payment the guest can send the receipt to their e-mail (needs the POS module).</div>
          </div>
          <Switch checked={receipt} onChange={setReceipt} label="E-mail the fiscal receipt" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line-2 px-5 py-3.5">
        <Button variant="primary" onClick={save} loading={update.isPending} disabled={!dirty}>
          Save
        </Button>
        <Button onClick={runTest} loading={test.isPending} disabled={!loaded.provider}>
          Test connection
        </Button>
        {testResult ? (
          <span role="status" className={cn('text-xs', testResult.ok ? 'text-success' : 'text-danger-text')}>
            {testResult.message}
          </span>
        ) : (
          <span className="text-xs text-muted">Only the owner can change these settings.</span>
        )}
      </div>
    </>
  );
}
