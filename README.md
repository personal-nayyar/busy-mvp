# Busy MVP — GST Billing & Accounting for Indian MSMEs

A minimal, demoable clone of BUSY: party/item masters, GST-compliant sales &
purchase invoicing, payments (with partial settlement), a double-entry accounting
core, automatic stock tracking, standard reports, and a dashboard. Single company,
single user — by design.

## Stack

- **Next.js 14** (app router, TypeScript) — UI + API route handlers in one app
- **better-sqlite3** — synchronous SQLite; DB file created & seeded on first run at `data/busy.db`
- **Vitest** — unit tests for the correctness-critical logic
- No external/paid services. Money is stored as **integer paise** (never floats).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (GST math, money rounding, GSTIN, ledger)
npm run typecheck  # tsc --noEmit
```

On first load the app seeds the default chart of accounts and a placeholder company.
Go to **Company Settings** first and set your company name + **state** (this is the
supplier state that decides CGST/SGST vs IGST).

## What you can do (demo walkthrough)

1. **Company Settings** — set name, GSTIN (validated), and home state.
2. **Parties** — add customers/suppliers with GSTIN, addresses, state, and an optional
   opening balance (receivable/payable). Opening balances post to the ledger on create.
3. **Items** — add products with HSN/SAC, GST rate, UOM, sale/purchase price, opening
   stock and a low-stock threshold. Opening stock posts to Stock-in-Hand.
4. **Sales Invoices / Purchase Bills** — pick a party + items; tax auto-computes
   (CGST+SGST for same-state, IGST for inter-state) at the item's rate, with a live
   preview. Saving auto-numbers the document, moves stock, and posts a balanced voucher.
   Sales invoices have a printable (Save-as-PDF) view.
5. **Receipts / Payments** — record money in/out against an invoice (partial allowed;
   overpayment blocked) or on-account. Invoice status flips UNPAID → PARTIAL → PAID.
6. **Ledgers** — per-account and per-party statements with running Dr/Cr balances and a
   date filter.
7. **Reports** — Sales/Purchase registers, Day Book, Trial Balance, Profit & Loss,
   Balance Sheet, GST Summary (output vs input vs net payable), and a Stock report with
   low-stock flags. All financial reports are derived from the ledger.
8. **Dashboard** — today's / this-month's sales, receivables, payables, and stock value.

## Correctness model

- **Money**: integer paise everywhere; 2dp HALF-UP; invoice grand total rounded to the
  nearest rupee via a Round-Off account. See `lib/money.ts`.
- **GST engine** (`lib/gst.ts`): pure function. Intra-state → CGST+SGST (each half the
  rate); inter-state → IGST at the full rate. Per-component HALF-UP rounding.
- **Ledger is the single source of truth** (`lib/ledger.ts`): every document posts a
  balanced double-entry voucher through `postVoucher`, which **rejects** any posting where
  debits ≠ credits. Reports and balances are computed from `ledger_entries`, never stored
  separately — so the trial balance always ties out and the balance sheet balances.

### Known simplification (intentional MVP scope)

Inventory uses the **periodic** method: purchases are expensed to a Purchases account and
sales to Sales; item stock **quantity/value** is tracked separately (shown in the stock
report and dashboard) but there is **no per-transaction perpetual COGS posting** and **no
automatic closing-stock adjustment into P&L**. This keeps double-entry simple and correct;
if you later want gross-profit-by-inventory in the P&L, that's the piece to add.

Out of scope (not built, by design): e-invoice/IRN/QR, e-way bills, GSTR filing/recon,
bank reconciliation, multi-company, multi-user/roles.

## Layout

```
lib/        money, gst, gstin, states, date, db (schema+seed), ledger (postings), reports
app/        dashboard (/) , parties, items, settings, sales, purchases, receipts,
            payments, ledgers, reports/*, and api/* route handlers
__tests__/  vitest unit tests
```
