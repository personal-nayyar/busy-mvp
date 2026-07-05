import { NextResponse } from "next/server";
import db from "@/lib/db";
import { toPaise } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** GET /api/items/[id] — fetch a single item. */
export function GET(_req: Request, { params }: Ctx) {
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(params.id);
  if (!row) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

/**
 * PUT /api/items/[id] — update descriptive fields, prices and threshold.
 * Opening stock is not re-posted and stock_qty is not changed here (stock moves
 * come from invoices).
 */
export async function PUT(req: Request, { params }: Ctx) {
  const existing = db.prepare("SELECT id FROM items WHERE id = ?").get(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
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

  const hsnSac = String(body.hsn_sac ?? "").trim() || null;
  const gstRate = Number(body.gst_rate ?? 0) || 0;
  const uom = String(body.uom ?? "").trim() || "NOS";
  const salePricePaise = toPaise(Number(body.sale_price ?? 0) || 0);
  const purchasePricePaise = toPaise(Number(body.purchase_price ?? 0) || 0);
  const lowStockThreshold = Number(body.low_stock_threshold ?? 0) || 0;

  db.prepare(
    `UPDATE items
       SET name = ?, hsn_sac = ?, gst_rate = ?, uom = ?,
           sale_price_paise = ?, purchase_price_paise = ?, low_stock_threshold = ?
     WHERE id = ?`
  ).run(
    name,
    hsnSac,
    gstRate,
    uom,
    salePricePaise,
    purchasePricePaise,
    lowStockThreshold,
    params.id
  );

  return NextResponse.json({ id: Number(params.id) });
}

/**
 * DELETE /api/items/[id] — only when the item is not referenced by any invoice
 * line. Otherwise reject with 400.
 */
export function DELETE(_req: Request, { params }: Ctx) {
  const existing = db.prepare("SELECT id FROM items WHERE id = ?").get(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const usedInLines = (
    db
      .prepare("SELECT COUNT(*) c FROM invoice_lines WHERE item_id = ?")
      .get(params.id) as { c: number }
  ).c;

  if (usedInLines > 0) {
    return NextResponse.json(
      { error: "Cannot delete an item that is used on invoices or bills." },
      { status: 400 }
    );
  }

  db.prepare("DELETE FROM items WHERE id = ?").run(params.id);
  return NextResponse.json({ ok: true });
}
