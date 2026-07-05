/**
 * Invoice creation — the single authoritative path for turning a SALES invoice
 * or PURCHASE bill into rows plus a balanced ledger posting and stock movement.
 *
 * Used by POST /api/invoices and by the demo seeder, so both produce identical
 * accounting. The caller is responsible for HTTP-level validation; this function
 * recomputes GST from scratch and throws on bad input.
 *
 * All amounts are INTEGER paise.
 */

import db, { getCompany, nextSequence } from "./db";
import { calculateGst, isInterState } from "./gst";
import { roundHalfUp } from "./money";
import { postSalesInvoice, postPurchaseBill } from "./ledger";

export interface InvoiceLineInput {
  item_id?: number | null;
  description?: string | null;
  hsn_sac?: string | null;
  qty: number;
  rate_paise: number;
  gst_rate: number;
}

export interface CreateInvoiceInput {
  type: "SALES" | "PURCHASE";
  party_id: number;
  date: string;
  notes?: string | null;
  lines: InvoiceLineInput[];
}

/**
 * Create an invoice/bill atomically: header + lines + stock move + ledger posting.
 * Throws if the party is missing or no line has qty > 0.
 */
export function createInvoice(input: CreateInvoiceInput): { id: number; number: string } {
  const type = input.type;
  const lines = (input.lines ?? []).filter((l) => Number(l.qty) > 0);
  if (lines.length === 0) {
    throw new Error("At least one line with qty > 0 is required");
  }

  const company = getCompany();
  const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(input.party_id) as
    | { id: number; state_code: string }
    | undefined;
  if (!party) {
    throw new Error("Party not found");
  }

  // Server is authoritative: recompute every line's taxable and all GST.
  const interstate = isInterState(company.state_code, party.state_code);
  const gstLines = lines.map((l) => ({
    taxableValue: roundHalfUp(Number(l.qty) * Number(l.rate_paise)),
    gstRate: Number(l.gst_rate) || 0,
  }));
  const gst = calculateGst({
    supplierState: company.state_code,
    placeOfSupply: party.state_code,
    lines: gstLines,
  });

  // Sales place-of-supply is the customer's state; purchase place-of-supply is our state.
  const placeOfSupply = type === "SALES" ? party.state_code : company.state_code;
  const number =
    type === "SALES"
      ? "INV-" + String(nextSequence("SALES_INV")).padStart(4, "0")
      : "BILL-" + String(nextSequence("PURCHASE_BILL")).padStart(4, "0");

  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO invoices
          (voucher_id, party_id, type, number, date, place_of_supply, is_interstate,
           subtotal_paise, cgst_paise, sgst_paise, igst_paise, cess_paise, rounding_paise,
           total_paise, amount_paid_paise, status, notes)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 'UNPAID', ?)`
      )
      .run(
        input.party_id,
        type,
        number,
        input.date,
        placeOfSupply,
        interstate ? 1 : 0,
        gst.totalTaxable,
        gst.totalCgst,
        gst.totalSgst,
        gst.totalIgst,
        gst.rounding,
        gst.grandTotal,
        input.notes ?? null
      );
    const invoiceId = Number(info.lastInsertRowid);

    const lineStmt = db.prepare(
      `INSERT INTO invoice_lines
        (invoice_id, item_id, description, hsn_sac, qty, rate_paise, gst_rate,
         taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise, line_total_paise)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    );
    const stockStmt = db.prepare("UPDATE items SET stock_qty = stock_qty + ? WHERE id = ?");

    lines.forEach((l, i) => {
      const t = gst.lines[i];
      lineStmt.run(
        invoiceId,
        l.item_id ?? null,
        l.description ?? null,
        l.hsn_sac ?? null,
        Number(l.qty),
        Math.round(Number(l.rate_paise)),
        Number(l.gst_rate) || 0,
        t.taxable,
        t.cgst,
        t.sgst,
        t.igst,
        t.total
      );
      if (l.item_id) {
        // Sales reduce stock; purchases add stock.
        const delta = type === "SALES" ? -Number(l.qty) : Number(l.qty);
        stockStmt.run(delta, l.item_id);
      }
    });

    const posting =
      type === "SALES"
        ? postSalesInvoice({
            date: input.date,
            partyId: input.party_id,
            number,
            narration: `Sales invoice ${number}`,
            interstate,
            taxable: gst.totalTaxable,
            cgst: gst.totalCgst,
            sgst: gst.totalSgst,
            igst: gst.totalIgst,
            rounding: gst.rounding,
            grandTotal: gst.grandTotal,
          })
        : postPurchaseBill({
            date: input.date,
            partyId: input.party_id,
            number,
            narration: `Purchase bill ${number}`,
            interstate,
            taxable: gst.totalTaxable,
            cgst: gst.totalCgst,
            sgst: gst.totalSgst,
            igst: gst.totalIgst,
            rounding: gst.rounding,
            grandTotal: gst.grandTotal,
          });

    db.prepare("UPDATE invoices SET voucher_id = ? WHERE id = ?").run(posting.voucherId, invoiceId);
    return invoiceId;
  });

  const id = run();
  return { id, number };
}
