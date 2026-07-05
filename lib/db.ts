/**
 * SQLite (better-sqlite3) connection, schema, and seed data. Single-company MVP.
 *
 * - All money columns are INTEGER paise.
 * - The DB is created and seeded on first import. A singleton is cached on
 *   globalThis so Next.js hot-reload doesn't open many handles.
 * - Set BUSY_DB_PATH (e.g. ":memory:") to override the file location — used by tests.
 */

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.BUSY_DB_PATH ?? path.join(process.cwd(), "data", "busy.db");

export type AccountType = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
export type VoucherType = "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "JOURNAL" | "OPENING";

export interface Company {
  id: number;
  name: string;
  gstin: string | null;
  state_code: string;
  address: string | null;
  phone: string | null;
  financial_year_start: string | null;
}

/** Stable keys for the seeded chart of accounts. Use these from ledger postings. */
export const ACCOUNTS: { key: string; code: string; name: string; type: AccountType }[] = [
  { key: "CASH", code: "1100", name: "Cash", type: "ASSET" },
  { key: "BANK", code: "1200", name: "Bank", type: "ASSET" },
  { key: "DEBTORS", code: "1300", name: "Sundry Debtors", type: "ASSET" },
  { key: "STOCK", code: "1400", name: "Stock-in-Hand", type: "ASSET" },
  { key: "INPUT_CGST", code: "1510", name: "Input CGST", type: "ASSET" },
  { key: "INPUT_SGST", code: "1520", name: "Input SGST", type: "ASSET" },
  { key: "INPUT_IGST", code: "1530", name: "Input IGST", type: "ASSET" },
  { key: "CREDITORS", code: "2100", name: "Sundry Creditors", type: "LIABILITY" },
  { key: "OUTPUT_CGST", code: "2210", name: "Output CGST", type: "LIABILITY" },
  { key: "OUTPUT_SGST", code: "2220", name: "Output SGST", type: "LIABILITY" },
  { key: "OUTPUT_IGST", code: "2230", name: "Output IGST", type: "LIABILITY" },
  { key: "OPENING_EQUITY", code: "3000", name: "Opening Balance Equity", type: "EQUITY" },
  { key: "SALES", code: "4000", name: "Sales", type: "INCOME" },
  { key: "ROUND_OFF", code: "4900", name: "Round-Off", type: "INCOME" },
  { key: "PURCHASES", code: "5000", name: "Purchases", type: "EXPENSE" },
];

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      gstin TEXT,
      state_code TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      financial_year_start TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE,
      code TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('ASSET','LIABILITY','INCOME','EXPENSE','EQUITY')),
      is_system INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gstin TEXT,
      billing_address TEXT,
      shipping_address TEXT,
      state_code TEXT NOT NULL,
      phone TEXT,
      opening_balance_paise INTEGER NOT NULL DEFAULT 0,
      opening_balance_type TEXT NOT NULL DEFAULT 'RECEIVABLE'
        CHECK (opening_balance_type IN ('RECEIVABLE','PAYABLE')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      hsn_sac TEXT,
      gst_rate REAL NOT NULL DEFAULT 0,
      uom TEXT NOT NULL DEFAULT 'NOS',
      sale_price_paise INTEGER NOT NULL DEFAULT 0,
      purchase_price_paise INTEGER NOT NULL DEFAULT 0,
      opening_stock_qty REAL NOT NULL DEFAULT 0,
      stock_qty REAL NOT NULL DEFAULT 0,
      low_stock_threshold REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('SALES','PURCHASE','RECEIPT','PAYMENT','JOURNAL','OPENING')),
      date TEXT NOT NULL,
      number TEXT NOT NULL,
      party_id INTEGER REFERENCES parties(id),
      narration TEXT,
      total_paise INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      party_id INTEGER REFERENCES parties(id),
      debit_paise INTEGER NOT NULL DEFAULT 0,
      credit_paise INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_le_account ON ledger_entries(account_id);
    CREATE INDEX IF NOT EXISTS idx_le_party ON ledger_entries(party_id);
    CREATE INDEX IF NOT EXISTS idx_le_voucher ON ledger_entries(voucher_id);

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER REFERENCES vouchers(id),
      party_id INTEGER NOT NULL REFERENCES parties(id),
      type TEXT NOT NULL CHECK (type IN ('SALES','PURCHASE')),
      number TEXT NOT NULL,
      date TEXT NOT NULL,
      place_of_supply TEXT NOT NULL,
      is_interstate INTEGER NOT NULL DEFAULT 0,
      subtotal_paise INTEGER NOT NULL DEFAULT 0,
      cgst_paise INTEGER NOT NULL DEFAULT 0,
      sgst_paise INTEGER NOT NULL DEFAULT 0,
      igst_paise INTEGER NOT NULL DEFAULT 0,
      cess_paise INTEGER NOT NULL DEFAULT 0,
      rounding_paise INTEGER NOT NULL DEFAULT 0,
      total_paise INTEGER NOT NULL DEFAULT 0,
      amount_paid_paise INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID','PARTIAL','PAID')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_inv_party ON invoices(party_id);
    CREATE INDEX IF NOT EXISTS idx_inv_type ON invoices(type);

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES items(id),
      description TEXT,
      hsn_sac TEXT,
      qty REAL NOT NULL DEFAULT 0,
      rate_paise INTEGER NOT NULL DEFAULT 0,
      gst_rate REAL NOT NULL DEFAULT 0,
      taxable_paise INTEGER NOT NULL DEFAULT 0,
      cgst_paise INTEGER NOT NULL DEFAULT 0,
      sgst_paise INTEGER NOT NULL DEFAULT 0,
      igst_paise INTEGER NOT NULL DEFAULT 0,
      cess_paise INTEGER NOT NULL DEFAULT 0,
      line_total_paise INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_il_invoice ON invoice_lines(invoice_id);

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      voucher_id INTEGER REFERENCES vouchers(id),
      amount_paise INTEGER NOT NULL,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_settle_invoice ON settlements(invoice_id);

    CREATE TABLE IF NOT EXISTS counters (
      kind TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function seed(db: Database.Database) {
  const accountCount = (db.prepare("SELECT COUNT(*) c FROM accounts").get() as { c: number }).c;
  if (accountCount === 0) {
    const stmt = db.prepare(
      "INSERT INTO accounts (key, code, name, type, is_system) VALUES (?, ?, ?, ?, 1)"
    );
    const insertAll = db.transaction(() => {
      for (const a of ACCOUNTS) stmt.run(a.key, a.code, a.name, a.type);
    });
    insertAll();
  }

  const companyCount = (db.prepare("SELECT COUNT(*) c FROM company").get() as { c: number }).c;
  if (companyCount === 0) {
    db.prepare(
      `INSERT INTO company (id, name, gstin, state_code, address, phone)
       VALUES (1, ?, ?, ?, ?, ?)`
    ).run("My Company", null, "27", "", null);
  }
}

function createDb(): Database.Database {
  if (DB_PATH !== ":memory:") {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  return db;
}

const globalForDb = globalThis as unknown as { __busyDb?: Database.Database };
const db: Database.Database = globalForDb.__busyDb ?? createDb();
if (!globalForDb.__busyDb) globalForDb.__busyDb = db;

export default db;

/** Read the single company row. */
export function getCompany(): Company {
  return db.prepare("SELECT * FROM company WHERE id = 1").get() as Company;
}

/** Resolve a seeded account's numeric id from its stable key. */
export function getAccountId(key: string): number {
  const row = db.prepare("SELECT id FROM accounts WHERE key = ?").get(key) as
    | { id: number }
    | undefined;
  if (!row) throw new Error("Unknown account key: " + key);
  return row.id;
}

/**
 * Atomically increment and return the next value for a named counter.
 * Safe to call inside an outer transaction (better-sqlite3 uses savepoints).
 */
export function nextSequence(kind: string): number {
  const run = db.transaction((k: string) => {
    db.prepare("INSERT INTO counters (kind, value) VALUES (?, 0) ON CONFLICT(kind) DO NOTHING").run(k);
    db.prepare("UPDATE counters SET value = value + 1 WHERE kind = ?").run(k);
    return (db.prepare("SELECT value FROM counters WHERE kind = ?").get(k) as { value: number })
      .value;
  });
  return run(kind);
}
