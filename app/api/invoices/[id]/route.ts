import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/invoices/[id] — one invoice with its lines and party. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  const invoice = db
    .prepare(
      `SELECT i.*, p.name AS party_name, p.gstin AS party_gstin,
              p.state_code AS party_state_code,
              p.billing_address AS party_billing_address,
              p.shipping_address AS party_shipping_address
       FROM invoices i
       JOIN parties p ON p.id = i.party_id
       WHERE i.id = ?`
    )
    .get(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  const lines = db
    .prepare("SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id")
    .all(id);
  return NextResponse.json({ invoice, lines });
}
