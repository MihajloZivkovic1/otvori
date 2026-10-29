# Octopos API — what the sandbox actually does (Phase 12)

Sources, in order of authority:

1. **The live sandbox**, `https://sandbox.octopos.rs/api`, tenant "Otvori.Menu" (our token in `apps/api/.env`,
   never committed). Every call below was made on 2026-10-26; the sanitised request/response pairs are in
   `apps/api/test/fixtures/octopos/*.json` and drive `apps/api/test/octopos-client.test.ts`.
2. **The OpenAPI document** behind the Swagger UI: `GET /api/swagger/docs/v1` (Swagger 2.0, Swashbuckle), saved as
   `docs/octopos/openapi.json`. 168 paths, 134 definitions. `apps/api/scripts/gen-octopos-client.mjs` turns the 16
   operations we use into `apps/api/src/modules/pos/providers/octopos/generated.ts` (`npm run gen:octopos`,
   `gen:octopos:check` in CI style).
3. **The WebOrder PDF/DOCX** Octopos sent (`docs/octopos/Octopos_API_dokumentacija_WebOrder.docx`), which documents
   `POST /WebOrder` only.

Where the three disagree, the sandbox wins; the differences are listed at the end.

## Authorization

`Authorization: Basic <token>` (the spec says "Basic TOKEN"; `Bearer <token>` is accepted too). A wrong or missing
key answers **401 with an empty body** — but only on routes that check it. On the sandbox `GET /Ping`, `/Tax`,
`/Table/*`, `/Product` and `/BusinessPartner/MyCompany` answer without any key, so none of them can be the
connection test. `GET /Currency/System` and everything under `/WebOrder` do check the key; **Test connection =
`GET /Currency/System` + `GET /Table/Active`** ("Connected — currency RSD, 92 active tables on the register").

Tokens are issued per tenant. The sandbox token is ours ("Otvori.Menu" shows up as the cashier on every receipt);
production venues each get their own token from Octopos, stored encrypted per venue, never shared.

## Envelope and errors

Every JSON answer is `{ "Success": bool, "Errors": [...], "Warnings": [...], "Data": … }` (`Warnings` is not in
the spec). Refusals are HTTP 400 with `Success:false` and one or more strings in `Errors`:

| Situation | `Errors` |
| --- | --- |
| unknown product code (no create fields) | `Product not found, code: 'X'` |
| payments ≠ items total | `Total payment amount is not the same as total items amount` |
| unknown / inactive table | `Invalid table, check if this table is active` |
| no items, malformed JSON | `Order must have at least one item` |
| tax label the PFR does not know | `Bad Request`, `items[0].labels[0]: Neispravne poreske stope` |
| same `ExternalId` twice | `There is already bill with same external id: X` |
| `/Pay` on a closed bill | `This bill is already printed` |
| unknown id / external id | `Resource not found` |
| handler crash | `Server error` + a .NET stack trace (still HTTP 400) |

Some routes answer `500 text/plain` ("An error occurred, please try again…") or `404 { "Message": … }`.
`OctoposClient` maps all of this to a `PosProviderError` with a `kind` (`auth`, `rejected`, `not_found`, `server`,
`timeout`, `unreachable`, `shape`) and a `retryable` flag; the queue retries only the last three kinds.

## Reads

- `GET /Ping` → `Data: "2026-10-26T14:43:46.063Z"` (server time, unauthenticated).
- `GET /Currency/System` → `{ Id, Code: "RSD", Name: "Dinar" }` (the spec says an array; the sandbox returns the object).
- `GET /Tax` → `[{ Id, Name, Value, FiscalLabel }]`. The sandbox PFR lists both the Serbian production labels
  (Ђ 20 %, Е 10 %, Г 0 %, А 0 %) and the **test labels** (A 10 %, B, C, E 6 %, F 11 %, N, P, T, Ж 19 %) — but only
  the test ones work on receipts there (see "Unknown product" below). Production PFRs use Ђ/Е/Г/А.
- `GET /BusinessPartner/MyCompany` → the tenant ("Lokal", PIB 000000000, "Adresa, 11000 Beograd"). Not what the
  receipt prints: the receipt header (PIB RS112832835, "Octopos Software doo", Vojvode Stepe 101) comes from the PFR.
- `GET /Table/Active` → the tables as a **flat array** `[{ Id, Name, IsActive, IsDeleted, IsTakeaway, … }]` (the
  spec declares `PageListDto[]`; the provider accepts both). 92 on the sandbox ("01"…"92", DOSTAVA01…).
  `GET /Table/Search?pageNumber=&pageSize=` is the paged form. `GET /Table/Occupied` → `[{ Id, Name, UserId,
  UserFullName, Amount, PickupCode?, DeliveryCustomer… }]` — the only way to tell that a table order is still open.
- `GET /Product?active=true&isForSale=true` → 877 products (965 KB) with `Code`, `Name`, `Price` (dinars),
  `CategoryId`, `ProductCategory { Name }`, `TaxPercent`, `UnitMeasureName`, `IsForSale`, `IsActive`, modifier
  groups, pictures… This is what Sync products reads (group name + tax come from here). The lighter
  `GET /WebOrder/Product?active=true` (1 383 rows, 300 KB) has only `Id, Code, Name, IsDecimal, Price, CategoryId`.
  1 183 of them have a `Code`; codes are free text (numbers, "ECG H4H", GUIDs).
- `GET /WebOrder/{billId}` → `BillDto`: `Id`, `BillCumulativeId`, `TableId`/`TableName`, `Amount`/`TotalAmount`,
  `Completed`, `IsRevoked`, `Payments` (always `null` on the sandbox, even after `/Pay`), `ExternalId` (**always
  `null` on the sandbox**, so you cannot find your order by it), `BillItems[] { ProductId, ProductCode, ProductName,
  Quantity, RevokedQuantity, Price, TaxValue, ElectronicFiscalizationTaxLabels, Info }`. Phase 9d assumed codes had
  to be resolved through the product list — they are right there. The id must be the **bill** id; the BillCumulative
  id answers 500.
- `GET /WebOrder/{billId}/FiscalReceipt?lineWidth=40` → `FiscalReceiptPrint` (below). By the bill id only (the
  BillCumulative id answers "Resource not found").
- `GET /BillCumulative/OpenBills?tableId=` → the open `BillDto`s of a table (`ExternalId` and `TableName` null).

## `POST /WebOrder` — the one write that matters

Body = `WebOrderDto` (spec + DOCX): `ExternalId` (recommended, unique per tenant for ever — a repeat is refused),
`TableName`, `Info`, `Items[] { ProductCode | ProductId, Quantity, Price (dinars, final price incl. modifiers),
Info, Modifiers[], and for a code the register does not know: ProductName, GroupName, TaxLabel, UnitMeasure }`,
`Payments[] { FiscalPaymentTypeId, Amount }` (sum must equal the items), `FiscalReceiptData { ReturnTextualRepresentation,
LineWidth 32–60, TaxNumber, BuyerId, TextBefore, TextAfter }`, `ValidateOnly`, `IsInvoice` + `CompanyTaxNumber`
(outgoing invoice instead of a receipt), `ElectronicFiscalizationInvoiceType` (0 Normal, 4 Advance),
`ElectronicFiscalizationIsRefund` + `ReferenceDocumentNumber/DT` (refunds), `Customer {…}`, `AutoAssignTablePrefix`,
`ScheduleTime`, `DisplayTime`, `ComputerName`, `Username`, `OrderCode`, `PickupCode`.

`FiscalPaymentTypeId`: 1 Cash (Готовина), 2 Card, 3 Cheque, 4 Wire transfer, 5 Voucher, **6 Mobile payment
(Инстант плаћање)**, 0 Other. The receipt prints the matching line.

Verified calls (fixtures in parentheses):

| # | Request | Result |
| --- | --- | --- |
| 1 | items + `Payments [{6 or 1}]` + `FiscalReceiptData`, `ValidateOnly: true` (`weborder-validate`) | 200, `Data: 0`, nothing created |
| 2 | same, cash, real (`weborder-cash`) | 200; `Data` **is the `FiscalReceiptPrint` itself**: `Id` 57691 (= BillCumulativeId), `TextTop` (the whole receipt, Cyrillic, 40 columns), `TextBottom` (`КРАЈ ФИСКАЛНОГ РАЧУНА` + the ESIR's text-after: "Your order number is: 66868" in ASCII art), `ImageBottom` (base64 PNG of the verification QR), `VerificationUrl` (`https://sandbox.suf.purs.gov.rs/v/?vl=…`), `InvoiceNumber` `SEU257EZ-Dt1Ov2o0-10369`, `SdcDateTime` `2026-10-26T15:45:04.76` (Belgrade wall time, no zone), `DoubleFontLineIndexes`, `TextAfterLineIndexes` |
| 3 | instant payment, 2 × 250 (`weborder-instant`) | receipt 10370, line `Инстант плаћање: 500,00` |
| 4 | unknown code `OTV-TEST-…` with `TaxLabel: "Ђ"` (`weborder-newcode-rejected`) | **400 `Neispravne poreske stope`** — the sandbox PFR does not accept the production label |
| 5 | same with `TaxLabel: "F"` (`weborder-newcode`) | receipt 10371; `GET /Product?keyword=otvori` now lists the product (Id 5557, 11 %, KOM, category "otvori test") — the register creates products on the fly |
| 6 | `TableName: "01"`, no `Payments` (`weborder-table-open`) | 200, `Data: 66871` (the bill id); `GET /Table/Occupied` shows 01 with 250 RSD |
| 7 | price 999 for a 250 product, `ValidateOnly` (`weborder-price-differs`) | accepted — the register takes the price we send |
| 8 | the same `ExternalId` twice (`weborder-duplicate-external-id`) | second call 400 `There is already bill with same external id` |

**The create fields are not harmless for codes the register knows.** Sending `ProductName`/`GroupName`/`TaxLabel`/
`UnitMeasure` with an existing code **updates that product**: a sale of code 686 with `ProductName: "Acqua Panna 0,25"`,
`GroupName: "otvori"` renamed "ACQUA PANA 250 CL" and moved it from VODE into a newly created "otvori" category
(found by our own live test on 2026-10-26; restored with `PUT /Product/449` and the recorded original). On a real till
that would rewrite the venue's catalogue (and, with another label, its tax rate). otvori therefore sends them only for
codes it generated itself (`PosLine.createIfMissing`, ESIR items without a POS code); mapped items go as
`{ ProductCode, Quantity, Price, Info }`. Side note: `GET /Product/{id}` never fills `IsForSale` / `ProductCategory`
(reads `false` / `null`); the list call does.

The DOCX's response example (`Data: { FiscalReceipt: {…}, Value: <orderId> }`) is **not** what the sandbox returns;
the provider accepts both. Without `ReturnTextualRepresentation` the answer is the bill id as a number.
Consequence: with the textual receipt in the answer you do **not** get the bill id (only the BillCumulative id and
the "order number" buried in `TextBottom`), so `GET /WebOrder/{id}/FiscalReceipt` is only usable when you asked
for a bare id first. otvori keeps `posRef` = receipt id (ESIR) or bill id (opened table order).

## POS mode: opening on a table and closing it

Works on the sandbox, with one catch.

- Open: `POST /WebOrder { TableName, Items }` → bill id; the table is occupied; `GET /WebOrder/{id}` reads it back
  with `ProductCode`s and `BillCumulativeId` (`weborder-get`).
- **`POST /WebOrder/{billCumulativeId}/Pay`** (`WebOrderPayRequestDto { Payments[], ComputerName, InvoiceType,
  CompanyTaxNumber, TextBefore/After, ReturnTextualRepresentation, LineWidth }`) closes the bill and returns the
  `FiscalReceiptPrint`; the table is free afterwards. But:
  - with the **bill** id it crashes (`NullReferenceException … BillCumulativeController.GetById`,
    `weborder-pay-bill-id-error`);
  - without `PaymentTypeId` it crashes (`Sequence contains no elements`, `weborder-pay-no-paymenttype-error`);
  - with `PaymentTypeId` it works, and **the receipt is labelled by that internal id, `FiscalPaymentTypeId` is
    ignored**: 2 → `Готовина` (`weborder-pay`, receipt 10372), 3 → `Платна картица` (10373), 6 → *no payment line at
    all* (10374), 0 → crash. There is no internal type for instant payments on the sandbox tenant.
  - a second `/Pay` → `This bill is already printed` (`weborder-pay-again-error`).
- `POST /WebOrder/{externalId}/Cancel` removes the open table order (`weborder-cancel`, `Data: [66874, 66875]` =
  the storno bills it created); the table is free; a second cancel answers 500 text; an unknown external id
  `Resource not found`. The cancelled bill reads back with `TotalAmount: 0` and negative `RevokedQuantity`
  (`IsRevoked` stays false).

So the correct way to turn a paid table order into a receipt with the right payment line is **cancel + reissue**:
`Cancel(externalId)` then `POST /WebOrder` with `Payments [{ FiscalPaymentTypeId: 6 }]` and a new
`ExternalId` (`otvori-<orderId>-r`). That is `closeStrategy: 'reissue'` (default). `closeStrategy: 'pay'` +
`payPaymentTypeId` exists for a venue whose Octopos has a payment type mapped to instant payments (ask Octopos —
open question 1). Before either, the provider reads the order back and checks `GET /Table/Occupied`: a table that
is free again while the order is not storno means the till closed it and issued the receipt there → the job fails
at once ("closed at the till") and staff mark "Issued at the register", so nothing is fiscalised twice.

## Idempotency and recovery

- `ExternalId` is enforced per tenant: a retry after a lost answer gets `There is already bill with same external
  id`. For `send_order` the queue treats that as done (the order is open, its id unknown; the close cancels by
  ExternalId, which needs no id). For a fiscalised receipt the answer cannot be fetched again (no lookup by
  ExternalId, `GET /BillCumulative/OpenBills` drops the id) — the job fails with the message and staff mark
  "issued at the register". Rare: it needs the receipt call to succeed *and* its answer to be lost.
- Refunds: `ElectronicFiscalizationIsRefund` + the reference document, or `POST /WebOrder/{externalId}/Cancel` for
  the whole bill. Not wired: refunds happen at the register / Octopos back office (a paid order cannot be rejected
  in the app).

## Differences versus Phase 9d's assumptions

| Phase 9d assumed (from the Wayback copy of octopos.rs) | Sandbox / spec |
| --- | --- |
| the public token is read-only, `POST /WebOrder` always 401 | our tenant token creates orders and receipts |
| lowercase `/weborder`, `/product` | `/WebOrder`, `/Product` (IIS is case-insensitive, the spec is PascalCase) |
| `GET /table` does not exist (405) | `GET /Table/Active`, `/Table/Search`, `/Table/Occupied` |
| `BillItems` carry only `ProductId` | they carry `ProductCode` too |
| closing an opened order = second `POST /WebOrder` with the same `ExternalId` (`closeMode`) | refused (duplicate ExternalId); use `/Pay` on the BillCumulative or cancel + reissue |
| `Data: { FiscalReceipt, Value }` | `Data` is the receipt itself; `Value` never appears |
| `TaxLabel: 'Ђ'` on every item | the sandbox PFR refuses Ђ; the label must match the venue's PFR (configurable, picker from `GET /Tax`) |
| the create fields are "harmless for known codes" | they overwrite the existing product's name and group — sent only for codes otvori generated |
| `printOnClose` switch | nothing in the API triggers printing; dropped |
| no tax labels, no company data | `GET /Tax`, `GET /BusinessPartner/MyCompany` |
| `GET /Ping` as connection test | unauthenticated; use `/Currency/System` |

## Open questions for Octopos

1. **POS mode in production**: is there (or can they configure) an internal `PaymentTypeId` mapped to instant
   payment, so `/Pay` prints `Инстант плаћање`? Until then: cancel + reissue. Does the till print receipts created
   through the API?
2. **ESIR mode pricing and certificate**: per-receipt price, the exact certificate procedure (docs/octopos-production.md
   has what we know), whether `ComputerName` / `Username` must be set in production.
3. **Tax labels per item**: otvori sends one label per venue (`taxLabel`, default Ђ). Venues with 10 % items need a
   per-item label — planned, not built.
4. **`ExternalId` lookup**: is there a way to find a bill by `ExternalId` (the field reads back `null`)?
5. **`SdcDateTime`** has no zone; we treat it as Europe/Belgrade. Confirm.
6. **Rate limits** on `GET /Product` (965 KB on the sandbox) — Sync products reads it on demand only.
