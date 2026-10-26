import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PublicOrderDto, PublicPaymentDto } from '@qr-menu/shared';
import { ids, menuOrdering, mockFetch, renderMenu, requests, type FetchHandler } from './helpers';

const ORDER_ID = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f';

function order(overrides: Partial<PublicOrderDto> = {}): PublicOrderDto {
  return {
    id: ORDER_ID,
    number: 142,
    status: 'accepted',
    tableNumber: 7,
    guestName: null,
    note: null,
    totalCents: 66000,
    currency: 'RSD',
    locale: 'sr',
    rejectedReason: null,
    items: [{ id: 'line-1', menuItemId: ids.cappuccino, variantId: null, name: 'Kapućino', variantName: null, unitPriceCents: 22000, quantity: 3, lineTotalCents: 66000, lineNote: null }],
    createdAt: '2026-10-22T11:42:00.000Z',
    acceptedAt: '2026-10-22T11:44:00.000Z',
    deliveredAt: null,
    closedAt: null,
    expiresAt: null,
    paymentStatus: 'unpaid',
    tipCents: 0,
    paidAmountCents: null,
    paidAt: null,
    payments: { enabled: true, tipPresets: [0, 5, 10, 15], receiptEmailEnabled: true },
    fiscalStatus: 'none',
    fiscalInvoiceNumber: null,
    fiscalVerificationUrl: null,
    fiscalIssuedAt: null,
    fiscalReceiptText: null,
    ...overrides,
  };
}

/**
 * Mock bank: POST …/payments creates an attempt (pending, 10 min), GET …/payments/:ref answers with whatever
 * `outcome` says the bank did by then; the order follows the latest attempt.
 */
function paymentApi(initial = order()) {
  const state = { order: initial, attempts: new Map<string, PublicPaymentDto>(), outcome: 'pending' as PublicPaymentDto['status'], created: 0 };
  const handler: FetchHandler = (url, init) => {
    const path = url.pathname;
    if (path.endsWith('/events')) return { status: 202, body: { ok: true } };
    if (path.endsWith('/menu')) return { body: menuOrdering };
    if (path.endsWith(`/orders/${ORDER_ID}`)) return { body: state.order };
    if (path.endsWith('/payments') && init?.method === 'POST') {
      const { tipPercent } = JSON.parse(String(init.body)) as { tipPercent: number };
      state.created += 1;
      const tipCents = Math.round((state.order.totalCents * tipPercent) / 100);
      const attempt: PublicPaymentDto = {
        ref: `mock_${state.created}`,
        status: 'pending',
        baseCents: state.order.totalCents,
        tipCents,
        amountCents: state.order.totalCents + tipCents,
        currency: 'RSD',
        qrPayload: `http://localhost:3100/dev/pay/mock_${state.created}`,
        deepLink: `http://localhost:3100/dev/pay/mock_${state.created}`,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        paidAt: null,
      };
      state.attempts.set(attempt.ref, attempt);
      state.order = { ...state.order, paymentStatus: 'pending', tipCents };
      return { status: 201, body: attempt };
    }
    const status = /\/payments\/([^/]+)$/.exec(path);
    if (status) {
      const attempt = state.attempts.get(status[1]!);
      if (!attempt) return { status: 404, body: { error: { code: 'PAYMENT_NOT_FOUND', message: 'nope' } } };
      if (state.outcome !== 'pending' && attempt.status === 'pending') {
        attempt.status = state.outcome;
        if (state.outcome === 'paid') {
          attempt.paidAt = new Date().toISOString();
          state.order = { ...state.order, paymentStatus: 'paid', paidAmountCents: attempt.amountCents, tipCents: attempt.tipCents, paidAt: attempt.paidAt };
        } else if (state.outcome === 'failed') {
          state.order = { ...state.order, paymentStatus: 'failed' };
        }
      }
      return { body: attempt };
    }
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: `no mock for ${path}` } } };
  };
  return { handler, state };
}

describe('pay by phone', () => {
  it('is offered for accepted orders with the module on, not before acceptance, not without the module', async () => {
    mockFetch(paymentApi(order({ status: 'new', acceptedAt: null, expiresAt: '2026-10-22T12:02:00.000Z' })).handler);
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    await screen.findByText('Poslato konobaru');
    expect(screen.queryByRole('button', { name: 'Plati telefonom' })).toBeNull();

    mockFetch(paymentApi(order({ payments: { enabled: false, tipPresets: [], receiptEmailEnabled: false } })).handler);
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    await screen.findAllByText('Prihvaćeno', { selector: 'h2' });
    expect(screen.queryByRole('button', { name: 'Plati telefonom' })).toBeNull();

    mockFetch(paymentApi().handler);
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    expect((await screen.findAllByRole('button', { name: 'Plati telefonom' })).length).toBeGreaterThan(0);
  });

  it('opens the sheet, shows the QR with the tip added, polls until the bank confirms and shows Plaćeno', { timeout: 20_000 }, async () => {
    const api = paymentApi();
    const spy = mockFetch(api.handler);
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Plati telefonom' }));
    const sheet = await screen.findByRole('dialog', { name: 'Plati telefonom' });
    expect(await within(sheet).findByRole('img', { name: 'Plati telefonom' })).toBeInTheDocument();
    expect(within(sheet).getByText('660 RSD')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Otvori aplikaciju banke' })).toHaveAttribute('href', 'http://localhost:3100/dev/pay/mock_1');
    expect(within(sheet).getByText(/Kod važi još 9:5\d|Kod važi još 10:00/)).toBeInTheDocument();

    // 10 % tip → a new attempt for 726 RSD.
    await user.click(within(sheet).getByRole('radio', { name: '10%' }));
    await waitFor(() => expect(within(sheet).getByText('726 RSD')).toBeInTheDocument());
    expect(within(sheet).getByText('uklj. napojnicu 66 RSD')).toBeInTheDocument();
    expect(api.state.created).toBe(2);

    api.state.outcome = 'paid';
    expect(await within(sheet).findByText('Hvala! Konobar je obavešten — ne moraš da tražiš račun.', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: 'Plaćeno ✓' })).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Gotovo' }));
    expect(await screen.findByText(/Plaćeno ✓/, { selector: 'p' })).toHaveTextContent('Plaćeno ✓· uklj. napojnicu 66 RSD');
    expect(screen.queryByRole('button', { name: 'Plati telefonom' })).toBeNull();
    expect(requests(spy).filter((r) => /\/payments\/mock_2$/.test(r.url.pathname)).length).toBeGreaterThan(0);
  });

  it('explains a declined payment and lets the guest retry; an expired code can be renewed', { timeout: 20_000 }, async () => {
    const api = paymentApi();
    mockFetch(api.handler);
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Plati telefonom' }));
    const sheet = await screen.findByRole('dialog', { name: 'Plati telefonom' });
    await within(sheet).findByRole('img', { name: 'Plati telefonom' });

    api.state.outcome = 'failed';
    expect(await within(sheet).findByRole('alert', {}, { timeout: 8000 })).toHaveTextContent('Plaćanje nije prošlo');
    expect(within(sheet).queryByRole('img')).toBeNull();
    api.state.outcome = 'pending';
    await user.click(within(sheet).getByRole('button', { name: 'Pokušaj ponovo' }));
    expect(await within(sheet).findByRole('img', { name: 'Plati telefonom' })).toBeInTheDocument();
    expect(api.state.created).toBe(2);

    api.state.outcome = 'expired';
    expect(await within(sheet).findByRole('alert', {}, { timeout: 8000 })).toHaveTextContent('Kod je istekao');
    expect(within(sheet).getByRole('button', { name: 'Pokušaj ponovo' })).toBeInTheDocument();
  });

  it('shows cash payments taken by the waiter', async () => {
    mockFetch(paymentApi(order({ status: 'delivered', deliveredAt: '2026-10-22T11:55:00.000Z', closedAt: '2026-10-22T11:55:00.000Z', paymentStatus: 'cash', paidAmountCents: 66000, paidAt: '2026-10-22T11:56:00.000Z' })).handler);
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    expect(await screen.findByText('Plaćeno kešom')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Plati telefonom' })).toBeNull();
  });
});

describe('fiscal receipt', () => {
  const paid = (fiscal: Partial<PublicOrderDto>) =>
    order({ paymentStatus: 'paid', paidAmountCents: 66000, paidAt: '2026-10-22T11:50:00.000Z', ...fiscal });

  it('shows the pending line while the register issues it, then the number, QR, link and e-mail form', async () => {
    const api = paymentApi(paid({ fiscalStatus: 'pending' }));
    mockFetch(api.handler);
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    expect(await screen.findByText('Fiskalni račun se izdaje na kasi…')).toBeInTheDocument();

    const spy = mockFetch((url, init) =>
      url.pathname.endsWith('/receipt-email') ? { status: 202, body: { ok: true } } : paymentApi(paid({
        fiscalStatus: 'issued',
        fiscalInvoiceNumber: 'MOCKPFR0-MOCKPFR0-001',
        fiscalVerificationUrl: 'https://sandbox.suf.purs.gov.rs/v/?vl=MOCK1',
        fiscalIssuedAt: null,
        fiscalReceiptText: '=== ФИСКАЛНИ РАЧУН ===',
      })).handler(url, init),
    );
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    const user = userEvent.setup();
    const section = await screen.findByRole('region', { name: 'Fiskalni račun' });
    expect(within(section).getByText('MOCKPFR0-MOCKPFR0-001')).toBeInTheDocument();
    expect(within(section).getByRole('img', { name: 'Fiskalni račun' })).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Otvori račun' })).toHaveAttribute('href', 'https://sandbox.suf.purs.gov.rs/v/?vl=MOCK1');
    // The PDF link opens the API route directly, so the guest session rides in the query string.
    const pdf = within(section).getByRole('link', { name: 'Preuzmi PDF' });
    expect(pdf).toHaveAttribute('target', '_blank');
    const pdfUrl = new URL(pdf.getAttribute('href')!);
    expect(pdfUrl.pathname).toBe(`/api/public/kafeterija/orders/${ORDER_ID}/receipt.pdf`);
    expect(pdfUrl.searchParams.get('s')).toBe(sessionStorage.getItem('tabla.session'));
    await user.click(within(section).getByRole('button', { name: 'Pošalji' }));
    expect(await within(section).findByRole('alert')).toHaveTextContent('Upiši ispravnu adresu.');
    await user.type(within(section).getByLabelText('Pošalji na mejl'), 'gost@example.com');
    await user.click(within(section).getByRole('button', { name: 'Pošalji' }));
    expect(await within(section).findByText('Poslato. Proveri sanduče.')).toBeInTheDocument();
    const mail = requests(spy).find((r) => r.url.pathname.endsWith('/receipt-email'));
    expect(JSON.parse(String(mail?.init?.body))).toEqual({ email: 'gost@example.com' });
  });

  it('shows the receipt for a cash order Octopos fiscalised for the venue (ESIR mode)', async () => {
    mockFetch(
      paymentApi(
        order({ paymentStatus: 'cash', paidAmountCents: 60000, paidAt: '2026-10-22T11:50:00.000Z', fiscalStatus: 'issued', fiscalInvoiceNumber: 'CASH-RCPT-2', fiscalVerificationUrl: 'https://sandbox.suf.purs.gov.rs/v/?vl=CASH2' }),
      ).handler,
    );
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    const section = await screen.findByRole('region', { name: 'Fiskalni račun' });
    expect(within(section).getByText('CASH-RCPT-2')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Preuzmi PDF' })).toBeInTheDocument();
  });

  it('hides the e-mail form when the venue turned receipt mails off', async () => {
    mockFetch(paymentApi(paid({ fiscalStatus: 'issued', fiscalInvoiceNumber: 'X-1', fiscalVerificationUrl: 'https://x/y', payments: { enabled: true, tipPresets: [0], receiptEmailEnabled: false } })).handler);
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    const section = await screen.findByRole('region', { name: 'Fiskalni račun' });
    expect(within(section).queryByLabelText('Pošalji na mejl')).toBeNull();
  });
});
