import { NextResponse } from "next/server";
import db from "@/lib/db";
import { toPaise, roundHalfUp } from "@/lib/money";
import { today } from "@/lib/date";
import { postOpeningStock } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/items — list all items (by name). */
export function GET() {
  const rows = db
    .prepare("SELECT * FROM items ORDER BY name COLLATE NOCASE ASC")
    .all();
  return NextResponse.json(rows);
}

/** POST /api/items — create an item and (optionally) post opening stock value. */
export async function POST(req: Request) {
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
  const openingStockQty = Number(body.opening_stock_qty ?? 0) || 0;
  const lowStockThreshold = Number(body.low_stock_threshold ?? 0) || 0;

  try {
    const create = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO items
             (name, hsn_sac, gst_rate, uom, sale_price_paise, purchase_price_paise,
              opening_stock_qty, stock_qty, low_stock_threshold)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          name,
          hsnSac,
          gstRate,
          uom,
          salePricePaise,
          purchasePricePaise,
          openingStockQty,
          openingStockQty,
          lowStockThreshold
        );
      const itemId = Number(info.lastInsertRowid);

      if (openingStockQty > 0 && purchasePricePaise > 0) {
        postOpeningStock({
          date: today(),
          amount: roundHalfUp(openingStockQty * purchasePricePaise),
        });
      }
      return itemId;
    });
    const id = create();
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create item";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
