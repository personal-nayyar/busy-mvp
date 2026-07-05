import { describe, it, expect, beforeAll } from "vitest";

// Force an isolated in-memory DB BEFORE anything transitively loads lib/db.ts.
process.env.BUSY_DB_PATH = ":memory:";

type LedgerModule = typeof import("@/lib/ledger");
type DbModule = typeof import("@/lib/db");

let ledger: LedgerModule;
let db: DbModule["default"];
let getAccountId: DbModule["getAccountId"];

/** Sum debit/credit for a voucher's ledger entries. */
function voucherSums(voucherId: number): { debit: number; credit: number } {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(debit_paise),0) debit, COALESCE(SUM(credit_paise),0) credit
       FROM ledger_entries WHERE voucher_id = ?`
    )
    .get(voucherId) as { debit: number; credit: number };
  return row;
}

/** Get the debit/credit for a specific account within a voucher. */
function accountEntry(
  voucherId: number,
  accountKey: string
): { debit: number; credit: number } {
  const accountId = getAccountId(accountKey);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(debit_paise),0) debit, COALESCE(SUM(credit_paise),0) credit
       FROM ledger_entries WHERE voucher_id = ? AND account_id = ?`
    )
    .get(voucherId, accountId) as { debit: number; credit: number };
  return row;
}

function insertParty(name = "T", state = "29"): number {
  const info = db
    .prepare("INSERT INTO parties (name, state_code) VALUES (?, ?)")
    .run(name, state);
  return Number(info.lastInsertRowid);
}

beforeAll(async () => {
  ledger = await import("@/lib/ledger");
  const dbMod = await import("@/lib/db");
  db = dbMod.default;
  getAccountId = dbMod.getAccountId;
});

describe("seeded database", () => {
  it("has a fresh in-memory DB with 15 seeded accounts", () => {
    const count = (
      db.prepare("SELECT COUNT(*) c FROM accounts").get() as { c: number }
    ).c;
    expect(count).toBe(15);
  });
});

describe("postVoucher", () => {
  it("throws on unbalanced lines", () => {
    expect(() =>
      ledger.postVoucher({
        type: "JOURNAL",
        date: "2026-07-05",
        lines: [
          { accountKey: "CASH", debit: 10000 },
          { accountKey: "BANK", credit: 5000 },
        ],
      })
    ).toThrow(/Unbalanced/);
  });

  it("posts a balanced JOURNAL whose entries sum debit === credit", () => {
    const { voucherId } = ledger.postVoucher({
      type: "JOURNAL",
      date: "2026-07-05",
      lines: [
        { accountKey: "CASH", debit: 10000 },
        { accountKey: "BANK", credit: 10000 },
      ],
    });
    const sums = voucherSums(voucherId);
    expect(sums.debit).toBe(sums.credit);
    expect(sums.debit).toBe(10000);
  });
});

describe("postSalesInvoice (interstate)", () => {
  it("posts a balanced voucher with DEBTORS/OUTPUT_IGST/SALES entries", () => {
    const partyId = insertParty("Sales Party", "29");
    const { voucherId } = ledger.postSalesInvoice({
      date: "2026-07-05",
      partyId,
      interstate: true,
      taxable: 100000,
      cgst: 0,
      sgst: 0,
      igst: 18000,
      grandTotal: 118000,
    });

    const sums = voucherSums(voucherId);
    expect(sums.debit).toBe(118000);
    expect(sums.credit).toBe(118000);

    expect(accountEntry(voucherId, "DEBTORS").debit).toBe(118000);
    expect(accountEntry(voucherId, "OUTPUT_IGST").credit).toBe(18000);
    expect(accountEntry(voucherId, "SALES").credit).toBe(100000);
  });
});

describe("postPurchaseBill (intra-state)", () => {
  it("posts a balanced voucher with CREDITORS/PURCHASES/INPUT_CGST/INPUT_SGST entries", () => {
    const partyId = insertParty("Purchase Party", "27");
    const { voucherId } = ledger.postPurchaseBill({
      date: "2026-07-05",
      partyId,
      interstate: false,
      taxable: 100000,
      cgst: 9000,
      sgst: 9000,
      igst: 0,
      grandTotal: 118000,
    });

    const sums = voucherSums(voucherId);
    expect(sums.debit).toBe(118000);
    expect(sums.credit).toBe(118000);

    expect(accountEntry(voucherId, "CREDITORS").credit).toBe(118000);
    expect(accountEntry(voucherId, "PURCHASES").debit).toBe(100000);
    expect(accountEntry(voucherId, "INPUT_CGST").debit).toBe(9000);
    expect(accountEntry(voucherId, "INPUT_SGST").debit).toBe(9000);
  });
});

describe("postReceipt", () => {
  it("debits CASH and credits DEBTORS, balanced", () => {
    const partyId = insertParty("Receipt Party", "27");
    const { voucherId } = ledger.postReceipt({
      date: "2026-07-05",
      partyId,
      amount: 50000,
      account: "CASH",
    });

    const sums = voucherSums(voucherId);
    expect(sums.debit).toBe(sums.credit);
    expect(sums.debit).toBe(50000);

    expect(accountEntry(voucherId, "CASH").debit).toBe(50000);
    expect(accountEntry(voucherId, "DEBTORS").credit).toBe(50000);
  });
});
