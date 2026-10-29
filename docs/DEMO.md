# End-to-end demo: scan → order → accept → pay by phone → fiscal receipt

What you see: a guest scans a table QR, orders, the waiter accepts on their phone, the guest pays with "their bank"
(the payment simulator, scanned with a second phone), the webhook marks the order paid, the mock register closes it
and a fiscal receipt appears on both phones. Everything runs on the laptop; no bank, no real register.

## 0. One-time set-up

```bash
npm install
npm run db:up                                   # Postgres 16 in Docker (port 5433 on this machine)
cp apps/api/.env.example apps/api/.env          # PAYMENTS_MOCK=true and POS_MOCK=true are already on in the example
cp apps/menu/.env.example apps/menu/.env        # VITE_API_URL=http://localhost:3100, VITE_DEFAULT_SLUG=kafeterija
cp apps/cms/.env.example apps/cms/.env
npm run build -w @qr-menu/shared
npm run migrate && npm run seed                 # Kafeterija Dorćol: every module on, mock payment provider + mock register
```

For the **second phone** the API must be reachable from the phone: set `API_URL` in `apps/api/.env` to your laptop's
LAN address (e.g. `http://192.168.1.20:3100`) — the payment QR encodes `API_URL/dev/pay/<ref>` — and open the menu
on the first phone through the same address or through the Vite dev server on the LAN (`npx vite --host` in
`apps/menu`, then `http://192.168.1.20:5174/t/7`; the host-based slug does not resolve on an IP, so
`VITE_DEFAULT_SLUG=kafeterija` from `.env` is what picks the venue). One phone is enough too: "Otvori aplikaciju
banke" opens the simulator on the same phone.

## 1. Start the stack (three terminals)

```bash
npm run dev -w @qr-menu/api        # http://localhost:3100  — logs show [pos] lines from the mock register
npm run dev -w @qr-menu/menu       # http://localhost:5174  (guest)
npm run dev -w @qr-menu/cms        # http://localhost:5173  (waiter / owner)
```

Sign in to the CMS as `ana@kafeterija.rs` / `tabla1234`. Settings → Modules shows Ordering, Online payment and POS
integration all **On**; Settings → Payment carries the SIMULATOR badge, Settings → Integrations the MOCK REGISTER badge
and the mode **"The venue’s own Octopos till (POS)"** selected (section 8 switches to the other mode).
Open **Orders** on the waiter phone (or a second browser window): the stream is live.

## 2. Scan the menu

Tables → Table 7 → the QR encodes `http://kafeterija.localhost:5174/t/7` (or your LAN URL). Scan it, or open the URL.
The guest sees "Sto 7" in the header and "+" on every item.

## 3. Order

Add two items, "Pogledaj korpu", optionally a name and a note, **Pošalji konobaru**. The order page shows
"Poslato konobaru" with the 20-minute expiry; the waiter screen plays the sound and shows the card under **New**
(with the "Unpaid" chip).

## 4. Accept

Waiter taps **Accept**. Guest sees "Prihvaćeno". In the API log: `[pos] would open order otvori-dev-<id> on table 7`
— the mock register received the order on the mapped table (Settings → Integrations → Table mapping). The staff card
now has `posRef`.

## 5. Pay through the simulator with a second phone

Guest taps **Plati telefonom**, picks a tip (e.g. 10 %), and gets the QR. Scan that QR with the **second phone**: it
opens `…/dev/pay/<ref>` — the simulator's "bank" page with the amount (tip included) and two buttons.
Tap **Plati …**. The page fires a signed webhook into `POST /api/webhooks/payments/mock`, exactly like a bank.

Watch the first phone: within 3 s the sheet flips to **Plaćeno ✓**, the order page shows "Plaćeno ✓ · uklj. napojnicu".
Watch the waiter phone: the chip turns **Paid · IPS · tip …** over the stream, then **Fiscal receipt pending…**.

(Tap **Odbij** instead to see the declined state and "Pokušaj ponovo"; wait 10 minutes to see the expired state.)

## 6. Webhook → POS close → fiscal receipt

Within 10 s the queue runs the `close_order` job. The API log shows `[pos] would cancel otvori-dev-<id>` and
`[pos] would close otvori-dev-<id> (reissue) with instant 360` — the table order is taken off the till and the receipt
is issued for the pre-tip amount (tips are not revenue) as "Инстант плаћање". The mock register answers with a fake
fiscal receipt:

- waiter card: **Fiscal receipt · …-001** (hover for the full number);
- guest order page: the **Fiskalni račun** block with the number, the verification QR, **Preuzmi PDF** (the 80 mm
  receipt: venue, PIB, the register's text in Cyrillic, the QR, the invoice number), "Otvori račun" and "Pošalji na
  mejl" (the mail lands in the API log with `MAIL_PROVIDER=log`, the PDF listed as an attachment).

To see the failure path, stop the mock register from the API shell (`mockPos.failNextCalls(6)` in a test) or set the
venue's provider to `octopos` with a wrong key in Settings → Integrations: the card shows
**Fiscal receipt pending — issue it at the register** with **Retry**; the paid state never changes. A wrong key fails
at once (it is not retried); an unreachable register is retried 30 s / 2 min / 10 min / 30 min / 2 h first.

## 7. Cash and the register's products

- A guest who pays the waiter: the waiter taps **Cash** on the card (chip "Cash"); no POS close is triggered.
- Settings → Integrations → **Sync products** reads the register's catalogue (the mock has ESP, CAP, LAT, TST), shows new
  codes and price changes, and applies what you tick; new items land in a hidden "Sa kase" category. The item editor
  shows "NO POS CODE" on items the register does not know; with "Send orders to the register" on, guests cannot order
  those until a code is set.

## 8. ESIR mode (Octopos issues the receipts, no till)

Settings → Integrations → pick **"Octopos issues the fiscal receipts (ESIR)"** → Save. The till options (send orders,
table mapping, close strategy) disappear and the per-receipt-cost note appears. Now:

- accepting an order sends nothing to the register;
- paying by phone → one `[pos] would fiscalise otvori-dev-<id>: instant 360` → receipt on both phones as above;
- the waiter taps **Cash** on another accepted order → `[pos] would fiscalise …: cash …` → the guest's order page shows
  the receipt too ("Plaćeno kešom" + Fiskalni račun), the waiter card the fiscal chip.

## 9. Against the real Octopos sandbox

The same flow with Octopos's sandbox as the register (receipts go to `sandbox.suf.purs.gov.rs`). Needs
`OCTOPOS_API_KEY` from `apps/api/.env` — paste it into the form, never into a file that is committed.

1. Settings → Integrations: provider **Octopos**, base URL `https://sandbox.octopos.rs/api`, API key, **tax label F**
   (the sandbox PFR refuses the production Ђ; the picker lists what it accepts), mode as you like → Save →
   **Test connection** ("Connected — currency RSD, 92 active tables on the register").
2. Menu codes: **Sync products** lists the sandbox catalogue (877 products — tick e.g. `686` ACQUA PANA 250 CL), or
   type `686` as the POS code of an existing item. In ESIR mode unmapped items also work (Octopos creates them as
   `OTV-…`); in POS mode they cannot be ordered while "Send orders to the register" is on.
3. POS mode: map table 7 to a sandbox table name (`07`; the field suggests the register's tables).
4. Order → accept → pay through the simulator as in steps 3–5. ESIR: the receipt is back within ~10 s. POS: accept
   opens the order on table `07` (the sandbox's `GET /Table/Occupied` shows it), the payment cancels it and issues the
   receipt. The receipt header says "Octopos Software doo" — the sandbox PFR's company, not the venue.

The automated version of this is `OCTOPOS_LIVE_WRITE=1 npx vitest run test/octopos-live.test.ts` in `apps/api`.

## Reset

`npm run seed` wipes and recreates the demo venues (orders, payments, jobs included).
