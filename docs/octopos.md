# Octopos API — what we learned (Phase 9d)

Source: https://octopos.rs/en/octopos-api/ (the site itself answered "currently not available" on 2026-10-22; the
pages were read from the Wayback Machine snapshot of 2025-05-23, sub-pages `authorization/`, `response/`, `products/`,
`create-receipt/`, `get-receipt/`, `get-fiscal-receipt/`, `sandbox/`) plus live probes of the sandbox.

## Authorization

- Every request carries `Authorization: Basic <token>`. The Sandbox page shows the same token sent as
  `Authorization: Bearer <token>`; the sandbox accepted both schemes for `GET /product`. `OctoposProvider` sends a bare
  stored key as `Basic <key>` and a value that already starts with `Basic `/`Bearer ` unchanged.
- The token is issued per customer after a demo request. The public example token on the docs is shared by every
  developer who reads the page, hence the `otvori-dev-` prefix on every `ExternalId` we send to the sandbox.

## Response envelope

`{ "Success": bool, "Errors": [...], "Data": <varies> }`. HTTP 200 only when `Success=true`; bad data is a 400 with
messages in `Errors` (Serbian, e.g. "Nevalidan sto, proverite da li je sto aktivan"). The sandbox also returns a
`Warnings` array the docs do not mention.

## Products — `GET /product`

Optional query: `keyword`, `active`, `isForSale`, `isWeb`. Documented fields: `Id`, `Name`, `IsActive`, `IsDecimal`,
`Price` (dinars, decimal), `Code`, `HotKeyDesktop`, `CategoryId`, `ModifierMinCount`, `ModifierMaxCount`, `LogoPath`,
`Logo`, `Modifiers[] { ProductId, Price }`, `HappyHours[] { DayOfWeek, TimeFrom, TimeTo, Price }`.
The sandbox adds undocumented fields: `Barcode`, `Description`, `SetMenus`, `ModifierGroups`, `ProductPictures`,
`Components`, `ProductCategory`, `IsPercent`, `IsForSale`, `IsModifierOnly`, `UnitMeasureName`, `TaxPercent`,
`ComponentInfo`, `Code2`, `HasStock`. The sandbox list has 1 383 products, 1 183 active ones with a `Code`.
There is **no group name or tax label in the product list** (only `CategoryId`, and on the sandbox `TaxPercent`);
`GroupName`/`TaxLabel` are only *inputs* when a receipt creates a product. Our import therefore maps
`group` ← `ProductCategory` (sandbox) or `#<CategoryId>` and `taxLabel` ← `TaxPercent` when present.

## Create receipt — `POST /weborder`

Request fields (from the payload table):

| Field | Required | Notes |
| --- | --- | --- |
| `TableName` | no | "Table name from method get all tables" (that method is **not documented**; `GET /table` answers 405 on the sandbox). An order with `TableName` and no `Payments` stays open on the table. |
| `CompanyTaxNumber`, `Info` | no | customer tax number; free note |
| `Items[]` | yes | `ProductCode` (yes), `ProductName`/`GroupName`/`UnitMeasure`/`TaxLabel` (mandatory only when the code is new — the register then creates the product), `Quantity` > 0, `Price` (dinars; must match the register's price or a happy-hour price), `Info`, `Modifiers[]` |
| `Payments[]` | "mandatory if TableName is empty" | `PaymentTypeId` 2=Cash 3=CreditCard 4=Invoice (legacy) **or** `FiscalPaymentTypeId` for Serbian e-fiscalisation: 1 Cash (Gotovina), 2 Card, 3 Cheque, 4 Wire transfer, 5 Voucher, **6 Mobile payment (Instant plaćanje)**, 0 Other. `Amount` — the sum must equal the items total. |
| `ExternalId` | recommended | our id to prevent duplicates; use a prefix in the sandbox |
| `ElectronicFiscalizationInvoiceType` | no | 0 Normal (default), 1 ProForma, 2 Copy, 3 Training, 4 Advance |
| `FiscalReceiptData` | no | `ReturnTextualRepresentation` (bool), `LineWidth` (32–60, default 40), `Jmbg`, `TaxNumber`, `BuyerId`, `BuyerCostCenterId`, `TextBefore`, `TextAfter` |
| `ReferenceDocumentNumber`, `ReferenceDocumentDT` | no | for copies / refunds |

Response: `Data` is the order id (number), or, with `ReturnTextualRepresentation`, an object
`{ FiscalReceipt: { Id, TextTop, TextBottom, VerificationUrl, InvoiceNumber, DoubleFontLineIndexes }, Value, Errors, Success }`
(`Value` = the order id). The sandbox example returns the receipt object directly in `Data` (`Id`, `TextTop`, …).
`OctoposProvider` accepts both shapes. Prices in receipts are dinars with two decimals; otvori stores minor units
and converts (`toDinars` / `toCents`).

## Get receipt — `GET /weborder/{id}`

`Data { Id, BillCumulativeId, TableId, TableName, TimeCreated, Amount, BillItems[] { ProductId, ProductName, Quantity,
Price, Info, BillItemModifiers[] } }`.

## Get fiscal receipt — `GET /weborder/{id}/fiscalreceipt?lineWidth=40`

`Data { Id, TextTop, TextBottom, VerificationUrl, InvoiceNumber, DoubleFontLineIndexes }`. Print preview = `TextTop`,
then a QR of `VerificationUrl` (the tax authority's SUF page; sandbox receipts point at `sandbox.suf.purs.gov.rs`),
then `TextBottom`. That is exactly what the guest's "Fiskalni račun" block and the e-mailed receipt show.

## Sandbox

- API URL `https://sandbox.octopos.rs/api/`, token on the Sandbox page (public, shared).
- Live probes on 2026-10-22 with the token from `.env`: `GET /product` → 200 (1.4 MB), `GET /table` → 405, `GET
  /category` → 404, **every `POST /weborder` → 401** with both the `Basic` and the `Bearer` form of the public token.
  So the public token is read-only; creating receipts needs a token Octopos issues to us.
- Consequence for the tests: `apps/api/test/pos.test.ts` runs `fetchProducts`/`testConnection` live when
  `OCTOPOS_SANDBOX_URL` and `OCTOPOS_SANDBOX_AUTH` are set, and the write path (`sendOrder`, `closeOrder`,
  `getFiscalReceipt`) only against fixtures recorded from the documented samples (`test/fixtures/octopos/*.json`,
  marked "fixture-only"). The whole flow runs end to end locally with the mock register (`POS_MOCK=true`).

## Open questions for Octopos

1. **Closing an order that was opened on a table.** The docs never show it. Is it a second `POST /weborder` with the
   same `ExternalId` plus `Payments` (our default `closeMode: 'reuse-external-id'`), or a separate receipt with a new
   `ExternalId` (`'new-receipt'`)? Does the register then close the open table order, or does it stay open? Switchable
   in Settings → Integrations until confirmed in a sandbox with write access.
2. **Table names**: "get all tables" is referenced but not documented (`GET /table` is 405). Until then the venue maps
   its tables to the register's table names by hand (Settings → Integrations → Table mapping).
3. **Price mismatch**: the docs say `Price` must be "product price from get products"; what happens when the menu
   price differs from the register's (rounding, happy hour)? We send our price; if the register rejects it the job
   retries and surfaces the error on the waiter card.
4. **`FiscalPaymentTypeId: 6` (Instant plaćanje)** is what we send for IPS payments; confirm that this is the right
   type for QR/deep-link IPS payments under the venue's fiscal set-up.
5. **Print on close** (`printOnClose`): there is no documented way to trigger the physical printer; we keep the switch
   for a future parameter and do nothing with it on the wire.
6. **Tips**: fiscalised amount is the order total without the tip. Where should the tip go on the register side
   (not revenue; probably not on the receipt at all)?
7. Rate limits, idempotency guarantees of `ExternalId` (does a repeated `ExternalId` return the existing order or
   an error?), and whether `Code` is unique per register.
