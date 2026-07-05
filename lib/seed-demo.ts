/**
 * Optional demo data for showcase deployments (e.g. Vercel).
 *
 * `seedDemo()` runs only when it finds an empty parties table, so:
 *  - it never touches a database that already has real data, and
 *  - on Vercel, where the SQLite file lives in the ephemeral /tmp and is recreated
 *    on every cold start, it re-populates the demo automatically each time.
 *
 * It goes through the same helpers as the API routes (createInvoice, postPartyOpening,
 * postOpeningStock), so the seeded ledger, GST and stock match real app output.
 *
 * Enable by setting the SEED_DEMO env var (see lib/db.ts). All amounts are rupees at
 * the input boundary and converted to paise via toPaise, mirroring the routes.
 */

import db from "./db";
import { toPaise, roundHalfUp } from "./money";
import { today, firstOfMonth } from "./date";
import { createInvoice } from "./invoices";
import { postPartyOpening, postOpeningStock } from "./ledger";

interface DemoParty {
  name: string;
  gstin: string | null;
  state_code: string;
  billing_address: string | null;
  phone: string | null;
  opening_balance?: number;
  opening_balance_type?: "RECEIVABLE" | "PAYABLE";
}

interface DemoItem {
  name: string;
  hsn_sac: string;
  gst_rate: number;
  uom: string;
  sale_price: number;
  purchase_price: number;
  opening_stock_qty: number;
  low_stock_threshold: number;
}

// Our company is seeded as state_code "27" (Maharashtra); parties in "27" are
// intra-state (CGST+SGST) and others are inter-state (IGST) so the demo shows both.
const PARTIES: DemoParty[] = [
  {
    name: "Sharma Electronics",
    gstin: "27ABCDE1234F1Z5",
    state_code: "27",
    billing_address: "12 MG Road, Pune, Maharashtra",
    phone: "9820011223",
    opening_balance: 15000,
    opening_balance_type: "RECEIVABLE",
  },
  {
    name: "Karnataka Traders",
    gstin: "29PQRSX6789K2Z1",
    state_code: "29",
    billing_address: "44 Brigade Road, Bengaluru, Karnataka",
    phone: "9845567788",
  },
  {
    name: "Delhi Wholesale Mart",
    gstin: "07LMNOP4321Q3Z9",
    state_code: "07",
    billing_address: "5 Chandni Chowk, New Delhi",
    phone: "9811122334",
  },
  {
    name: "Gujarat Supplies Co",
    gstin: "24EFGHI9876J4Z2",
    state_code: "24",
    billing_address: "18 Ashram Road, Ahmedabad, Gujarat",
    phone: "9909988776",
    opening_balance: 8000,
    opening_balance_type: "PAYABLE",
  },
];

const ITEMS: DemoItem[] = [
  {
    name: "Wireless Mouse",
    hsn_sac: "8471",
    gst_rate: 18,
    uom: "NOS",
    sale_price: 650,
    purchase_price: 420,
    opening_stock_qty: 120,
    low_stock_threshold: 20,
  },
  {
    name: "Mechanical Keyboard",
    hsn_sac: "8471",
    gst_rate: 18,
    uom: "NOS",
    sale_price: 2800,
    purchase_price: 1950,
    opening_stock_qty: 40,
    low_stock_threshold: 10,
  },
  {
    name: "USB-C Cable 1m",
    hsn_sac: "8544",
    gst_rate: 12,
    uom: "NOS",
    sale_price: 250,
    purchase_price: 120,
    opening_stock_qty: 15,
    low_stock_threshold: 25, // intentionally below threshold -> shows in Low Stock
  },
  {
    name: "Laptop Stand",
    hsn_sac: "7616",
    gst_rate: 18,
    uom: "NOS",
    sale_price: 1200,
    purchase_price: 780,
    opening_stock_qty: 60,
    low_stock_threshold: 15,
  },
  {
    name: "Printer Paper A4 (Ream)",
    hsn_sac: "4802",
    gst_rate: 12,
    uom: "REAM",
    sale_price: 320,
    purchase_price: 210,
    opening_stock_qty: 8,
    low_stock_threshold: 12, // below threshold -> Low Stock
  },
];

function createDemoParty(p: DemoParty): number {
  const openingPaise = p.opening_balance && p.opening_balance > 0 ? toPaise(p.opening_balance) : 0;
  const openingType = p.opening_balance_type ?? "RECEIVABLE";
  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO parties
           (name, gstin, billing_address, shipping_address, state_code, phone,
            opening_balance_paise, opening_balance_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        p.name,
        p.gstin,
        p.billing_address,
        p.billing_address,
        p.state_code,
        p.phone,
        openingPaise,
        openingType
      );
    const partyId = Number(info.lastInsertRowid);
    if (openingPaise > 0) {
      postPartyOpening({ date: firstOfMonth(), partyId, amount: openingPaise, type: openingType });
    }
    return partyId;
  });
  return run();
}

function createDemoItem(it: DemoItem): number {
  const salePaise = toPaise(it.sale_price);
  const purchasePaise = toPaise(it.purchase_price);
  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO items
           (name, hsn_sac, gst_rate, uom, sale_price_paise, purchase_price_paise,
            opening_stock_qty, stock_qty, low_stock_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        it.name,
        it.hsn_sac,
        it.gst_rate,
        it.uom,
        salePaise,
        purchasePaise,
        it.opening_stock_qty,
        it.opening_stock_qty,
        it.low_stock_threshold
      );
    const itemId = Number(info.lastInsertRowid);
    if (it.opening_stock_qty > 0 && purchasePaise > 0) {
      postOpeningStock({
        date: firstOfMonth(),
        amount: roundHalfUp(it.opening_stock_qty * purchasePaise),
      });
    }
    return itemId;
  });
  return run();
}

/**
 * Populate demo company/parties/items/invoices. No-op if any parties already exist.
 */
export function seedDemo(): void {
  const partyCount = (db.prepare("SELECT COUNT(*) c FROM parties").get() as { c: number }).c;
  if (partyCount > 0) return;

  // Give the seeded company a real-looking identity for the dashboard header.
  db.prepare(
    `UPDATE company
       SET name = ?, gstin = ?, state_code = ?, address = ?, phone = ?
     WHERE id = 1`
  ).run(
    "Acme Traders Pvt Ltd",
    "27ACMET1234A1Z0",
    "27",
    "88 Industrial Estate, Mumbai, Maharashtra",
    "02240001234"
  );

  const partyIds = PARTIES.map(createDemoParty);
  const itemIds = ITEMS.map(createDemoItem);

  const iso = today();
  const monthStart = firstOfMonth(iso);

  // A couple of sales invoices dated today (lights up "Today's Sales") ...
  createInvoice({
    type: "SALES",
    party_id: partyIds[0], // Maharashtra -> intra-state (CGST+SGST)
    date: iso,
    notes: "Demo sales invoice",
    lines: [
      { item_id: itemIds[0], qty: 10, rate_paise: toPaise(650), gst_rate: 18 },
      { item_id: itemIds[3], qty: 4, rate_paise: toPaise(1200), gst_rate: 18 },
    ],
  });
  createInvoice({
    type: "SALES",
    party_id: partyIds[1], // Karnataka -> inter-state (IGST)
    date: iso,
    notes: "Demo sales invoice",
    lines: [{ item_id: itemIds[1], qty: 3, rate_paise: toPaise(2800), gst_rate: 18 }],
  });

  // ... and one earlier in the month (adds to "This Month's Sales" only).
  createInvoice({
    type: "SALES",
    party_id: partyIds[2], // Delhi -> inter-state (IGST)
    date: monthStart,
    notes: "Demo sales invoice",
    lines: [
      { item_id: itemIds[0], qty: 15, rate_paise: toPaise(650), gst_rate: 18 },
      { item_id: itemIds[2], qty: 20, rate_paise: toPaise(250), gst_rate: 12 },
    ],
  });

  // A purchase bill (creates payables and restocks items).
  createInvoice({
    type: "PURCHASE",
    party_id: partyIds[3], // Gujarat -> inter-state (IGST)
    date: monthStart,
    notes: "Demo purchase bill",
    lines: [
      { item_id: itemIds[1], qty: 10, rate_paise: toPaise(1950), gst_rate: 18 },
      { item_id: itemIds[4], qty: 30, rate_paise: toPaise(210), gst_rate: 12 },
    ],
  });
}
