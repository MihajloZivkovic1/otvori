import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { Payment, Restaurant } from '../../db/models/index.js';
import { decryptSecret } from '../../utils/crypto.js';
import { logger } from '../../utils/logger.js';
import { MOCK_SIGNATURE_HEADER, recordMockOutcome, signMockWebhook, type MockWebhookBody } from './providers/mock.js';
import { storedConfig } from './config.js';

/**
 * Payment simulator (PAYMENTS_MOCK=true only): the page a phone lands on after scanning a mock QR. "Pay" / "Decline"
 * post back here, and this handler fires a signed webhook into our own POST /api/webhooks/payments/mock — the same
 * path a real bank callback takes, so the whole flow (webhook → order paid → SSE → POS close) runs end to end.
 */
export const paymentSimulatorRouter = Router();

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function money(cents: number, currency: string): string {
  const whole = Math.trunc(cents / 100);
  const minor = Math.abs(cents % 100);
  return `${whole.toLocaleString('sr-RS')}${minor ? `,${String(minor).padStart(2, '0')}` : ''} ${currency}`;
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${escape(title)}</title>
<style>
  :root{color-scheme:light}body{margin:0;font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:#F7F2EB;color:#1F1A17}
  main{max-width:420px;margin:0 auto;padding:32px 20px;display:flex;flex-direction:column;gap:16px}
  .card{background:#fff;border-radius:18px;padding:22px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
  h1{font:400 26px/1.2 Georgia,serif;margin:0 0 6px}.muted{color:#6e645c;font-size:14px;margin:0}
  .amount{font-size:34px;font-weight:700;margin:14px 0 4px}
  .btn{display:flex;align-items:center;justify-content:center;height:52px;border-radius:14px;border:0;font:600 16px inherit;cursor:pointer;width:100%}
  .pay{background:#7A3E48;color:#fff}.decline{background:#fff;color:#1F1A17;border:1px solid #d9d2c9;margin-top:10px}
  .tag{display:inline-block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#7A3E48;border:1px solid #7A3E48;border-radius:6px;padding:2px 7px}
  .ok{color:#2f7a3e}.bad{color:#a23b3b}
</style></head><body><main>${body}</main></body></html>`;
}

async function loadAttempt(ref: string) {
  const payment = await Payment.findOne({ where: { provider: 'mock', providerRef: ref }, include: [{ model: Restaurant, attributes: ['id', 'name', 'currency', 'paymentConfig'] }] });
  return payment?.restaurant ? payment : null;
}

paymentSimulatorRouter.get('/:ref', async (req, res) => {
  const payment = await loadAttempt(String(req.params.ref));
  res.setHeader('Cache-Control', 'no-store');
  if (!payment) {
    res.status(404).type('html').send(page('Nepoznato plaćanje', `<div class="card"><h1>Nepoznato plaćanje</h1><p class="muted">Ovaj QR kod ne odgovara nijednom plaćanju.</p></div>`));
    return;
  }
  const restaurant = payment.restaurant!;
  const expired = payment.status === 'pending' && payment.expiresAt.getTime() <= Date.now();
  const amount = money(payment.amountCents, restaurant.currency);
  let body: string;
  if (payment.status === 'paid') {
    body = `<div class="card"><span class="tag">Simulator</span><h1 class="ok">Plaćeno ✓</h1><p class="muted">${escape(amount)} · ${escape(restaurant.name)}</p></div>`;
  } else if (payment.status !== 'pending' || expired) {
    body = `<div class="card"><span class="tag">Simulator</span><h1 class="bad">${expired ? 'Isteklo' : 'Odbijeno'}</h1><p class="muted">Zatraži novi QR kod u meniju.</p></div>`;
  } else {
    body = `<div class="card"><span class="tag">Simulator banke</span><h1>${escape(restaurant.name)}</h1><p class="muted">IPS plaćanje · ref ${escape(payment.providerRef.slice(-8))}</p>
<div class="amount">${escape(amount)}</div><p class="muted">Napojnica ${escape(money(payment.tipCents, restaurant.currency))} je uključena.</p>
<form method="post" action="${escape(`${env.API_URL}/dev/pay/${payment.providerRef}/confirm`)}">
<button class="btn pay" name="outcome" value="paid">Plati ${escape(amount)}</button>
<button class="btn decline" name="outcome" value="failed">Odbij</button></form></div>
<p class="muted">Ovo je simulator za razvoj: dugme šalje potpisani webhook u otvori API, kao što bi banka uradila.</p>`;
  }
  res.type('html').send(page(`Plaćanje · ${restaurant.name}`, body));
});

const confirmSchema = z.object({ outcome: z.enum(['paid', 'failed']) });

paymentSimulatorRouter.post('/:ref/confirm', async (req, res) => {
  const payment = await loadAttempt(String(req.params.ref));
  res.setHeader('Cache-Control', 'no-store');
  if (!payment) {
    res.status(404).json({ error: { code: 'PAYMENT_NOT_FOUND', message: 'Unknown reference' } });
    return;
  }
  const { outcome } = confirmSchema.parse(req.body);
  const restaurant = payment.restaurant!;
  const secret = storedConfig(restaurant).secretEncrypted;
  if (!secret) {
    res.status(409).json({ error: { code: 'PAYMENT_PROVIDER_UNAVAILABLE', message: 'The venue has no merchant secret; set one in Settings → Payment' } });
    return;
  }
  const body: MockWebhookBody = {
    providerRef: payment.providerRef,
    status: outcome,
    amountCents: payment.amountCents,
    paidAt: outcome === 'paid' ? new Date().toISOString() : null,
  };
  recordMockOutcome(payment.providerRef, { status: outcome, amountCents: payment.amountCents, paidAt: body.paidAt ? new Date(body.paidAt) : null });
  const { json, signature } = signMockWebhook(decryptSecret(secret), body);
  // Like a bank: an HTTP call to the public webhook URL (so Caddy / CORS / raw-body handling are all exercised).
  const webhookUrl = `${env.API_URL}/api/webhooks/payments/mock`;
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [MOCK_SIGNATURE_HEADER]: signature },
    body: json,
    signal: AbortSignal.timeout(10_000),
  }).catch((error: unknown) => {
    logger.error({ err: error, webhookUrl }, 'Simulator could not reach the webhook endpoint');
    return null;
  });
  const ok = Boolean(response?.ok);
  const wantsJson = (req.get('accept') ?? '').includes('application/json');
  if (wantsJson) {
    res.status(ok ? 200 : 502).json({ ok, outcome, webhook: response?.status ?? null });
    return;
  }
  const amount = money(payment.amountCents, restaurant.currency);
  const heading = !ok ? '<h1 class="bad">Webhook nije prošao</h1>' : outcome === 'paid' ? '<h1 class="ok">Plaćeno ✓</h1>' : '<h1 class="bad">Odbijeno</h1>';
  res.type('html').send(page(`Plaćanje · ${restaurant.name}`, `<div class="card"><span class="tag">Simulator</span>${heading}<p class="muted">${escape(amount)} · ${escape(restaurant.name)}</p><p class="muted">Vrati se u meni na prvom telefonu — status se osvežava sam.</p></div>`));
});

// The simulator form posts urlencoded; the JSON parser in app.ts does not cover it.
paymentSimulatorRouter.use((_req, _res, next) => next());
