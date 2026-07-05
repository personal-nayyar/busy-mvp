import { NextRequest, NextResponse } from "next/server";
import db, { getCompany, nextSequence } from "@/lib/db";
import { calculateGst, isInterState } from "@/lib/gst";
import { roundHalfUp } from "@/lib/money";
import { postSalesInvoice, postPurchaseBill } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingLine {
  item_id?: number | null;
  description?: string | null;
  hsn_sac?: string | null;
  qty: number;
  rate_paise: number;
  gst_rate: number;
}

interface CreateBody {
  type: "SALES" | "PURCHASE";
  party_id: number;
  date: string;
  notes?: string | null;
  lines: IncomingLine[];
}

/** GET /api/invoices?type=SALES|PURCHASE — list invoices with party name. */
export function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const where = type === "SALES" || type === "PURCHASE" ? "WHERE i.type = ?" : "";
  const rows = db
    .prepare(
      `SELECT i.*, p.name AS party_name
       FROM invoices i
       JOIN parties p ON p.id = i.party_id
       ${where}
       ORDER BY i.date DESC, i.id DESC`
    )
    .all(...(where ? [type] : []));
  return NextResponse.json({ invoices: rows });
}

/** POST /api/invoices — create a SALES invoice or PURCHASE bill. Server recomputes GST. */
export async function POST(req: NextRequest) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = body.type;
  if (type !== "SALES" && type !== "PURCHASE") {
    return NextResponse.json({ error: "type must be SALES or PURCHASE" }, { status: 400 });
  }
  if (!body.party_id) {
    return NextResponse.json({ error: "party_id is required" }, { status: 400 });
  }
  if (!body.date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }
  const lines = (body.lines ?? []).filter((l) => Number(l.qty) > 0);
  if (lines.length === 0) {
    return NextResponse.json({ error: "At least one line with qty > 0 is required" }, { status: 400 });
  }

  const company = getCompany();
  const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(body.party_id) as
    | { id: number; state_code: string }
    | undefined;
  if (!party) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
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

  try {
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
          body.party_id,
          type,
          number,
          body.date,
          placeOfSupply,
          interstate ? 1 : 0,
          gst.totalTaxable,
          gst.totalCgst,
          gst.totalSgst,
          gst.totalIgst,
          gst.rounding,
          gst.grandTotal,
          body.notes ?? null
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
              date: body.date,
              partyId: body.party_id,
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
              date: body.date,
              partyId: body.party_id,
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
    return NextResponse.json({ id, number });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
