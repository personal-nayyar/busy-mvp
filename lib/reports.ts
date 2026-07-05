/**
 * Report query helpers. Every financial number here is DERIVED FROM THE LEDGER
 * (ledger_entries joined to vouchers for the date), which is the single source of
 * truth. The only exceptions are the stock report (physical quantities live on the
 * items table) and the register *detail* rows (which read the invoices table for
 * the document-level tax breakup — those figures are themselves posted to the
 * ledger, so the registers reconcile with the books).
 *
 * All amounts are INTEGER paise. Dates are ISO "YYYY-MM-DD" strings; range filters
 * are inclusive of both `from` and `to`.
 */

import db, { AccountType } from "./db";
import { roundHalfUp } from "./money";

/* ------------------------------------------------------------------ *
 * Registers (Sales / Purchase)
 * ------------------------------------------------------------------ */

export interface RegisterRow {
  id: number;
  number: string;
  date: string;
  party: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface RegisterReport {
  rows: RegisterRow[];
  totals: {
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
}

function registerFor(type: "SALES" | "PURCHASE", from: string, to: string): RegisterReport {
  const rows = db
    .prepare(
      `SELECT i.id                       AS id,
              i.number                   AS number,
              i.date                     AS date,
              COALESCE(p.name, '—')      AS party,
              i.subtotal_paise           AS taxable,
              i.cgst_paise               AS cgst,
              i.sgst_paise               AS sgst,
              i.igst_paise               AS igst,
              i.total_paise              AS total
         FROM invoices i
         LEFT JOIN parties p ON p.id = i.party_id
        WHERE i.type = @type AND i.date >= @from AND i.date <= @to
        ORDER BY i.date ASC, i.id ASC`
    )
    .all({ type, from, to }) as RegisterRow[];

  const totals = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
  for (const r of rows) {
    totals.taxable += r.taxable;
    totals.cgst += r.cgst;
    totals.sgst += r.sgst;
    totals.igst += r.igst;
    totals.total += r.total;
  }
  return { rows, totals };
}

export function salesRegister(from: string, to: string): RegisterReport {
  return registerFor("SALES", from, to);
}

export function purchaseRegister(from: string, to: string): RegisterReport {
  return registerFor("PURCHASE", from, to);
}

/* ------------------------------------------------------------------ *
 * Day Book — every voucher in range with its ledger lines
 * ------------------------------------------------------------------ */

export interface DayBookLine {
  accountCode: string | null;
  accountName: string;
  debit: number;
  credit: number;
}

export interface DayBookVoucher {
  voucherId: number;
  type: string;
  date: string;
  number: string;
  narration: string | null;
  party: string | null;
  lines: DayBookLine[];
  totalDebit: number;
  totalCredit: number;
}

export function dayBook(from: string, to: string): DayBookVoucher[] {
  const rows = db
    .prepare(
      `SELECT v.id            AS voucher_id,
              v.type          AS type,
              v.date          AS date,
              v.number        AS number,
              v.narration     AS narration,
              p.name          AS party,
              a.code          AS account_code,
              a.name          AS account_name,
              le.debit_paise  AS debit,
              le.credit_paise AS credit
         FROM vouchers v
         JOIN ledger_entries le ON le.voucher_id = v.id
         JOIN accounts a        ON a.id = le.account_id
         LEFT JOIN parties p    ON p.id = v.party_id
        WHERE v.date >= @from AND v.date <= @to
        ORDER BY v.date ASC, v.id ASC, le.id ASC`
    )
    .all({ from, to }) as {
    voucher_id: number;
    type: string;
    date: string;
    number: string;
    narration: string | null;
    party: string | null;
    account_code: string | null;
    account_name: string;
    debit: number;
    credit: number;
  }[];

  const byVoucher = new Map<number, DayBookVoucher>();
  for (const r of rows) {
    let v = byVoucher.get(r.voucher_id);
    if (!v) {
      v = {
        voucherId: r.voucher_id,
        type: r.type,
        date: r.date,
        number: r.number,
        narration: r.narration,
        party: r.party,
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
      };
      byVoucher.set(r.voucher_id, v);
    }
    v.lines.push({
      accountCode: r.account_code,
      accountName: r.account_name,
      debit: r.debit,
      credit: r.credit,
    });
    v.totalDebit += r.debit;
    v.totalCredit += r.credit;
  }
  return [...byVoucher.values()];
}

/* ------------------------------------------------------------------ *
 * Account balances (as-on) — the backbone of TB / P&L / Balance Sheet
 * ------------------------------------------------------------------ */

export interface AccountBalance {
  id: number;
  key: string | null;
  code: string | null;
  name: string;
  type: AccountType;
  debit: number; // total debits posted up to asOf
  credit: number; // total credits posted up to asOf
  balance: number; // debit - credit (net debit; negative means net credit)
}

/**
 * For every account, sum debits and credits from ledger entries whose voucher date
 * is <= asOf. We LEFT JOIN so accounts with no entries still appear with zeros, and
 * we gate the amounts with a CASE on the voucher date (rather than an ON/WHERE date
 * filter) so entries dated after asOf contribute nothing yet cannot drop the row.
 */
export function accountBalances(asOf: string): AccountBalance[] {
  const rows = db
    .prepare(
      `SELECT a.id   AS id,
              a.key  AS key,
              a.code AS code,
              a.name AS name,
              a.type AS type,
              COALESCE(SUM(CASE WHEN v.date <= @asOf THEN le.debit_paise  ELSE 0 END), 0) AS debit,
              COALESCE(SUM(CASE WHEN v.date <= @asOf THEN le.credit_paise ELSE 0 END), 0) AS credit
         FROM accounts a
         LEFT JOIN ledger_entries le ON le.account_id = a.id
         LEFT JOIN vouchers v        ON v.id = le.voucher_id
        GROUP BY a.id
        ORDER BY a.code ASC`
    )
    .all({ asOf }) as Omit<AccountBalance, "balance">[];

  return rows.map((r) => ({ ...r, balance: r.debit - r.credit }));
}

/* ------------------------------------------------------------------ *
 * Trial Balance
 * ------------------------------------------------------------------ */

export interface TrialBalanceRow {
  code: string | null;
  name: string;
  type: AccountType;
  debit: number; // shown on the Dr column (0 if this account nets to a credit)
  credit: number; // shown on the Cr column (0 if this account nets to a debit)
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}

/**
 * Each account's closing balance (debit - credit up to asOf) is placed on the Dr
 * side if net-debit, else on the Cr side. Because total debits == total credits in
 * the ledger, the sum of Dr placements equals the sum of Cr placements, so the
 * trial balance always ties out.
 */
export function trialBalance(asOf: string): TrialBalanceReport {
  const balances = accountBalances(asOf);
  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const b of balances) {
    if (b.balance === 0) continue; // skip accounts with no closing balance
    const debit = b.balance > 0 ? b.balance : 0;
    const credit = b.balance < 0 ? -b.balance : 0;
    totalDebit += debit;
    totalCredit += credit;
    rows.push({ code: b.code, name: b.name, type: b.type, debit, credit });
  }

  return { rows, totalDebit, totalCredit };
}

/* ------------------------------------------------------------------ *
 * Profit & Loss (period)
 * ------------------------------------------------------------------ */

export interface PLRow {
  code: string | null;
  name: string;
  amount: number;
}

export interface ProfitAndLossReport {
  income: PLRow[];
  expense: PLRow[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number; // totalIncome - totalExpense
}

/**
 * Income accounts are measured as credits-minus-debits over the period; expense
 * accounts as debits-minus-credits. Only the entries whose voucher date falls in
 * [from,to] are counted (gated with a CASE so every income/expense account still
 * lists, even at zero).
 */
export function profitAndLoss(from: string, to: string): ProfitAndLossReport {
  const rows = db
    .prepare(
      `SELECT a.code AS code,
              a.name AS name,
              a.type AS type,
              COALESCE(SUM(CASE WHEN v.date >= @from AND v.date <= @to THEN le.debit_paise  ELSE 0 END), 0) AS debit,
              COALESCE(SUM(CASE WHEN v.date >= @from AND v.date <= @to THEN le.credit_paise ELSE 0 END), 0) AS credit
         FROM accounts a
         LEFT JOIN ledger_entries le ON le.account_id = a.id
         LEFT JOIN vouchers v        ON v.id = le.voucher_id
        WHERE a.type IN ('INCOME','EXPENSE')
        GROUP BY a.id
        ORDER BY a.code ASC`
    )
    .all({ from, to }) as {
    code: string | null;
    name: string;
    type: AccountType;
    debit: number;
    credit: number;
  }[];

  const income: PLRow[] = [];
  const expense: PLRow[] = [];
  let totalIncome = 0;
  let totalExpense = 0;

  for (const r of rows) {
    if (r.type === "INCOME") {
      const amount = r.credit - r.debit;
      if (amount === 0) continue;
      totalIncome += amount;
      income.push({ code: r.code, name: r.name, amount });
    } else {
      const amount = r.debit - r.credit;
      if (amount === 0) continue;
      totalExpense += amount;
      expense.push({ code: r.code, name: r.name, amount });
    }
  }

  return { income, expense, totalIncome, totalExpense, netProfit: totalIncome - totalExpense };
}

/* ------------------------------------------------------------------ *
 * Balance Sheet (as-on)
 * ------------------------------------------------------------------ */

export interface BSRow {
  code: string | null;
  name: string;
  amount: number;
}

export interface BalanceSheetReport {
  assets: BSRow[];
  liabilities: BSRow[];
  equity: BSRow[]; // includes the retained-earnings / profit line
  totalAssets: number;
  totalLiabEquity: number;
  difference: number; // totalAssets - totalLiabEquity; should be 0
}

/**
 * Assets are shown as net debit (debit - credit); liabilities and equity as net
 * credit (credit - debit). Current-period earnings are folded into equity as
 * retained earnings = (all income credit-debit) - (all expense debit-credit) up to
 * asOf, i.e. netProfit for all time. This makes the sheet balance automatically,
 * because across every account debits equal credits.
 */
export function balanceSheet(asOf: string): BalanceSheetReport {
  const balances = accountBalances(asOf);

  const assets: BSRow[] = [];
  const liabilities: BSRow[] = [];
  const equity: BSRow[] = [];
  let totalAssets = 0;
  let totalLiabEquity = 0;
  let retainedEarnings = 0;

  for (const b of balances) {
    if (b.type === "ASSET") {
      const amount = b.debit - b.credit;
      if (amount !== 0) {
        assets.push({ code: b.code, name: b.name, amount });
        totalAssets += amount;
      }
    } else if (b.type === "LIABILITY") {
      const amount = b.credit - b.debit;
      if (amount !== 0) {
        liabilities.push({ code: b.code, name: b.name, amount });
        totalLiabEquity += amount;
      }
    } else if (b.type === "EQUITY") {
      const amount = b.credit - b.debit;
      if (amount !== 0) {
        equity.push({ code: b.code, name: b.name, amount });
        totalLiabEquity += amount;
      }
    } else if (b.type === "INCOME") {
      retainedEarnings += b.credit - b.debit;
    } else if (b.type === "EXPENSE") {
      retainedEarnings -= b.debit - b.credit;
    }
  }

  // Fold retained earnings (net profit to date) into the equity side.
  equity.push({ code: null, name: "Retained Earnings (Net Profit)", amount: retainedEarnings });
  totalLiabEquity += retainedEarnings;

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabEquity,
    difference: totalAssets - totalLiabEquity,
  };
}

/* ------------------------------------------------------------------ *
 * GST Summary (period)
 * ------------------------------------------------------------------ */

export interface GstSummaryReport {
  outputCgst: number;
  outputSgst: number;
  outputIgst: number;
  inputCgst: number;
  inputSgst: number;
  inputIgst: number;
  totalOutput: number;
  totalInput: number;
  netPayable: number; // totalOutput - totalInput
}

/**
 * Output tax (a liability) is credits-minus-debits on the OUTPUT_* accounts over
 * the period; input tax credit (an asset) is debits-minus-credits on the INPUT_*
 * accounts. Amounts are gated to [from,to] with a CASE on the voucher date.
 */
export function gstSummary(from: string, to: string): GstSummaryReport {
  const rows = db
    .prepare(
      `SELECT a.key AS key,
              COALESCE(SUM(CASE WHEN v.date >= @from AND v.date <= @to THEN le.debit_paise  ELSE 0 END), 0) AS debit,
              COALESCE(SUM(CASE WHEN v.date >= @from AND v.date <= @to THEN le.credit_paise ELSE 0 END), 0) AS credit
         FROM accounts a
         LEFT JOIN ledger_entries le ON le.account_id = a.id
         LEFT JOIN vouchers v        ON v.id = le.voucher_id
        WHERE a.key IN ('OUTPUT_CGST','OUTPUT_SGST','OUTPUT_IGST','INPUT_CGST','INPUT_SGST','INPUT_IGST')
        GROUP BY a.key`
    )
    .all({ from, to }) as { key: string; debit: number; credit: number }[];

  const byKey = new Map(rows.map((r) => [r.key, r]));
  const outCr = (k: string) => {
    const r = byKey.get(k);
    return r ? r.credit - r.debit : 0;
  };
  const inDr = (k: string) => {
    const r = byKey.get(k);
    return r ? r.debit - r.credit : 0;
  };

  const outputCgst = outCr("OUTPUT_CGST");
  const outputSgst = outCr("OUTPUT_SGST");
  const outputIgst = outCr("OUTPUT_IGST");
  const inputCgst = inDr("INPUT_CGST");
  const inputSgst = inDr("INPUT_SGST");
  const inputIgst = inDr("INPUT_IGST");

  const totalOutput = outputCgst + outputSgst + outputIgst;
  const totalInput = inputCgst + inputSgst + inputIgst;

  return {
    outputCgst,
    outputSgst,
    outputIgst,
    inputCgst,
    inputSgst,
    inputIgst,
    totalOutput,
    totalInput,
    netPayable: totalOutput - totalInput,
  };
}

/* ------------------------------------------------------------------ *
 * Stock Report (from items — physical quantities)
 * ------------------------------------------------------------------ */

export interface StockRow {
  id: number;
  name: string;
  hsnSac: string | null;
  uom: string;
  gstRate: number;
  stockQty: number;
  purchasePrice: number; // paise per unit
  stockValue: number; // paise
  lowStock: boolean;
}

export interface StockReport {
  rows: StockRow[];
  totalValue: number;
}

export function stockReport(): StockReport {
  const items = db
    .prepare(
      `SELECT id, name, hsn_sac, uom, gst_rate, stock_qty, purchase_price_paise, low_stock_threshold
         FROM items
        ORDER BY name ASC`
    )
    .all() as {
    id: number;
    name: string;
    hsn_sac: string | null;
    uom: string;
    gst_rate: number;
    stock_qty: number;
    purchase_price_paise: number;
    low_stock_threshold: number;
  }[];

  let totalValue = 0;
  const rows: StockRow[] = items.map((it) => {
    const stockValue = roundHalfUp(it.stock_qty * it.purchase_price_paise);
    totalValue += stockValue;
    return {
      id: it.id,
      name: it.name,
      hsnSac: it.hsn_sac,
      uom: it.uom,
      gstRate: it.gst_rate,
      stockQty: it.stock_qty,
      purchasePrice: it.purchase_price_paise,
      stockValue,
      lowStock: it.low_stock_threshold > 0 && it.stock_qty <= it.low_stock_threshold,
    };
  });

  return { rows, totalValue };
}
