import { NextResponse } from "next/server";
import db from "@/lib/db";
import { isValidGstin } from "@/lib/gstin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** GET /api/parties/[id] — fetch a single party. */
export function GET(_req: Request, { params }: Ctx) {
  const row = db.prepare("SELECT * FROM parties WHERE id = ?").get(params.id);
  if (!row) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

/**
 * PUT /api/parties/[id] — update descriptive fields only.
 * Opening balance is set once at creation and is not re-posted here.
 */
export async function PUT(req: Request, { params }: Ctx) {
  const existing = db.prepare("SELECT id FROM parties WHERE id = ?").get(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const stateCode = String(body.state_code ?? "").trim();
  if (!stateCode) {
    return NextResponse.json({ error: "State is required" }, { status: 400 });
  }

  const gstin: string | null = String(body.gstin ?? "").trim().toUpperCase() || null;
  if (gstin && !isValidGstin(gstin)) {
    return NextResponse.json({ error: "Invalid GSTIN" }, { status: 400 });
  }

  const billingAddress = String(body.billing_address ?? "").trim() || null;
  const shippingAddress = String(body.shipping_address ?? "").trim() || null;
  const phone = String(body.phone ?? "").trim() || null;

  db.prepare(
    `UPDATE parties
       SET name = ?, gstin = ?, billing_address = ?, shipping_address = ?,
           state_code = ?, phone = ?
     WHERE id = ?`
  ).run(name, gstin, billingAddress, shippingAddress, stateCode, phone, params.id);

  return NextResponse.json({ id: Number(params.id) });
}

/**
 * DELETE /api/parties/[id] — only when the party has no ledger/voucher/invoice
 * activity. Otherwise reject with 400 and a clear message.
 */
export function DELETE(_req: Request, { params }: Ctx) {
  const existing = db.prepare("SELECT id FROM parties WHERE id = ?").get(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }

  const ledger = (
    db
      .prepare("SELECT COUNT(*) c FROM ledger_entries WHERE party_id = ?")
      .get(params.id) as { c: number }
  ).c;
  const vouchers = (
    db.prepare("SELECT COUNT(*) c FROM vouchers WHERE party_id = ?").get(params.id) as {
      c: number;
    }
  ).c;
  const invoices = (
    db.prepare("SELECT COUNT(*) c FROM invoices WHERE party_id = ?").get(params.id) as {
      c: number;
    }
  ).c;

  if (ledger > 0 || vouchers > 0 || invoices > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a party that has transactions (opening balance, invoices, or vouchers).",
      },
      { status: 400 }
    );
  }

  db.prepare("DELETE FROM parties WHERE id = ?").run(params.id);
  return NextResponse.json({ ok: true });
}
