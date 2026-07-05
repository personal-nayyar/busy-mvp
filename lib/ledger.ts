/**
 * Double-entry ledger posting. The ledger is the single source of truth: every
 * financial document posts a BALANCED set of debit/credit lines through
 * `postVoucher`, which rejects anything where total debit != total credit.
 *
 * Higher-level helpers (postSalesInvoice, postPurchaseBill, postReceipt, ...) encode
 * the exact posting rules once, so the feature modules can't post inconsistent
 * entries. Feature modules own the invoices / settlements tables and stock updates;
 * they call these helpers for the accounting side, ideally inside one
 * `db.transaction(...)` so document + postings commit atomically.
 *
 * All amounts are INTEGER paise.
 */

import db, { VoucherType, getAccountId, nextSequence } from "./db";

export interface PostingLine {
  accountKey: string;
  partyId?: number | null;
  debit?: number;
  credit?: number;
}

export interface VoucherInput {
  type: VoucherType;
  date: string;
  number?: string;
  partyId?: number | null;
  narration?: string;
  lines: PostingLine[];
}

const NUMBER_PREFIX: Record<VoucherType, string> = {
  SALES: "INV",
  PURCHASE: "BILL",
  RECEIPT: "RCP",
  PAYMENT: "PAY",
  JOURNAL: "JV",
  OPENING: "OP",
};

export function formatVoucherNumber(type: VoucherType): string {
  const seq = nextSequence("VCH_" + type);
  return `${NUMBER_PREFIX[type]}-${String(seq).padStart(4, "0")}`;
}

/**
 * Insert a voucher and its ledger entries. Validates that debits equal credits and
 * that no line mixes debit and credit. Throws on an unbalanced or empty voucher.
 * Runs its inserts as-is; wrap in `db.transaction(...)` to make it atomic with other
 * writes (nested transactions are fine — better-sqlite3 uses savepoints).
 */
export function postVoucher(input: VoucherInput): { voucherId: number; number: string } {
  const lines = input.lines.map((l) => ({
    accountKey: l.accountKey,
    partyId: l.partyId ?? null,
    debit: Math.round(l.debit ?? 0),
    credit: Math.round(l.credit ?? 0),
  }));

  let totalDr = 0;
  let totalCr = 0;
  for (const l of lines) {
    if (l.debit < 0 || l.credit < 0) throw new Error("Ledger line amounts must be non-negative");
    if (l.debit > 0 && l.credit > 0) throw new Error("A ledger line cannot have both debit and credit");
    totalDr += l.debit;
    totalCr += l.credit;
  }
  if (totalDr === 0 && totalCr === 0) throw new Error("Cannot post an empty voucher");
  if (totalDr !== totalCr) {
    throw new Error(`Unbalanced voucher: debit ${totalDr} != credit ${totalCr}`);
  }

  const number = input.number ?? formatVoucherNumber(input.type);

  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO vouchers (type, date, number, party_id, narration, total_paise)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(input.type, input.date, number, input.partyId ?? null, input.narration ?? null, totalDr);
    const voucherId = Number(info.lastInsertRowid);

    const lineStmt = db.prepare(
      `INSERT INTO ledger_entries (voucher_id, account_id, party_id, debit_paise, credit_paise)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const l of lines) {
      lineStmt.run(voucherId, getAccountId(l.accountKey), l.partyId, l.debit, l.credit);
    }
    return voucherId;
  });

  const voucherId = run();
  return { voucherId, number };
}

/** Append a Round-Off line that absorbs any residual imbalance (invoice rounding). */
function withRoundOff(lines: PostingLine[]): PostingLine[] {
  let dr = 0;
  let cr = 0;
  for (const l of lines) {
    dr += Math.round(l.debit ?? 0);
    cr += Math.round(l.credit ?? 0);
  }
  const diff = dr - cr;
  if (diff === 0) return lines;
  return [
    ...lines,
    diff > 0 ? { accountKey: "ROUND_OFF", credit: diff } : { accountKey: "ROUND_OFF", debit: -diff },
  ];
}

export interface InvoicePostingInput {
  date: string;
  partyId: number;
  number?: string;
  narration?: string;
  interstate: boolean;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Optional; the round-off line is derived from the actual debit/credit residual. */
  rounding?: number;
  grandTotal: number;
}

/**
 * Sales invoice: Dr Sundry Debtors (grand total); Cr Sales (taxable);
 * Cr Output IGST or Cr Output CGST + Output SGST; Round-Off for the rest.
 */
export function postSalesInvoice(input: InvoicePostingInput) {
  const lines: PostingLine[] = [
    { accountKey: "DEBTORS", partyId: input.partyId, debit: input.grandTotal },
    { accountKey: "SALES", credit: input.taxable },
  ];
  if (input.interstate) {
    if (input.igst) lines.push({ accountKey: "OUTPUT_IGST", credit: input.igst });
  } else {
    if (input.cgst) lines.push({ accountKey: "OUTPUT_CGST", credit: input.cgst });
    if (input.sgst) lines.push({ accountKey: "OUTPUT_SGST", credit: input.sgst });
  }
  return postVoucher({
    type: "SALES",
    date: input.date,
    number: input.number,
    partyId: input.partyId,
    narration: input.narration,
    lines: withRoundOff(lines),
  });
}

/**
 * Purchase bill: Dr Purchases (taxable); Dr Input IGST or Input CGST + Input SGST;
 * Cr Sundry Creditors (grand total); Round-Off for the rest.
 */
export function postPurchaseBill(input: InvoicePostingInput) {
  const lines: PostingLine[] = [{ accountKey: "PURCHASES", debit: input.taxable }];
  if (input.interstate) {
    if (input.igst) lines.push({ accountKey: "INPUT_IGST", debit: input.igst });
  } else {
    if (input.cgst) lines.push({ accountKey: "INPUT_CGST", debit: input.cgst });
    if (input.sgst) lines.push({ accountKey: "INPUT_SGST", debit: input.sgst });
  }
  lines.push({ accountKey: "CREDITORS", partyId: input.partyId, credit: input.grandTotal });
  return postVoucher({
    type: "PURCHASE",
    date: input.date,
    number: input.number,
    partyId: input.partyId,
    narration: input.narration,
    lines: withRoundOff(lines),
  });
}

export interface SettlementPostingInput {
  date: string;
  partyId: number;
  amount: number;
  /** Where the money lands (receipt) or comes from (payment). */
  account?: "CASH" | "BANK";
  number?: string;
  narration?: string;
}

/** Receipt from a customer: Dr Cash/Bank; Cr Sundry Debtors. */
export function postReceipt(input: SettlementPostingInput) {
  const account = input.account ?? "CASH";
  return postVoucher({
    type: "RECEIPT",
    date: input.date,
    number: input.number,
    partyId: input.partyId,
    narration: input.narration,
    lines: [
      { accountKey: account, debit: input.amount },
      { accountKey: "DEBTORS", partyId: input.partyId, credit: input.amount },
    ],
  });
}

/** Payment to a supplier: Dr Sundry Creditors; Cr Cash/Bank. */
export function postPayment(input: SettlementPostingInput) {
  const account = input.account ?? "CASH";
  return postVoucher({
    type: "PAYMENT",
    date: input.date,
    number: input.number,
    partyId: input.partyId,
    narration: input.narration,
    lines: [
      { accountKey: "CREDITORS", partyId: input.partyId, debit: input.amount },
      { accountKey: account, credit: input.amount },
    ],
  });
}

/**
 * Party opening balance. RECEIVABLE => Dr Sundry Debtors / Cr Opening Balance Equity.
 * PAYABLE => Dr Opening Balance Equity / Cr Sundry Creditors.
 */
export function postPartyOpening(args: {
  date: string;
  partyId: number;
  amount: number;
  type: "RECEIVABLE" | "PAYABLE";
  narration?: string;
}) {
  if (args.amount <= 0) return null;
  const lines: PostingLine[] =
    args.type === "RECEIVABLE"
      ? [
          { accountKey: "DEBTORS", partyId: args.partyId, debit: args.amount },
          { accountKey: "OPENING_EQUITY", credit: args.amount },
        ]
      : [
          { accountKey: "OPENING_EQUITY", debit: args.amount },
          { accountKey: "CREDITORS", partyId: args.partyId, credit: args.amount },
        ];
  return postVoucher({
    type: "OPENING",
    date: args.date,
    partyId: args.partyId,
    narration: args.narration ?? "Opening balance",
    lines,
  });
}

/** Opening stock: Dr Stock-in-Hand / Cr Opening Balance Equity. */
export function postOpeningStock(args: { date: string; amount: number; narration?: string }) {
  if (args.amount <= 0) return null;
  return postVoucher({
    type: "OPENING",
    date: args.date,
    narration: args.narration ?? "Opening stock",
    lines: [
      { accountKey: "STOCK", debit: args.amount },
      { accountKey: "OPENING_EQUITY", credit: args.amount },
    ],
  });
}
