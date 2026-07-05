import { NextResponse } from "next/server";
import db from "@/lib/db";
import { toPaise } from "@/lib/money";
import { isValidGstin } from "@/lib/gstin";
import { today } from "@/lib/date";
import { postPartyOpening } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/parties — list all parties (newest first). */
export function GET() {
  const rows = db
    .prepare("SELECT * FROM parties ORDER BY name COLLATE NOCASE ASC")
    .all();
  return NextResponse.json(rows);
}

/** POST /api/parties — create a party and (optionally) post its opening balance. */
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

  const stateCode = String(body.state_code ?? "").trim();
  if (!stateCode) {
    return NextResponse.json({ error: "State is required" }, { status: 400 });
  }

  let gstin: string | null = String(body.gstin ?? "").trim().toUpperCase() || null;
  if (gstin && !isValidGstin(gstin)) {
    return NextResponse.json({ error: "Invalid GSTIN" }, { status: 400 });
  }

  const billingAddress = String(body.billing_address ?? "").trim() || null;
  const shippingAddress = String(body.shipping_address ?? "").trim() || null;
  const phone = String(body.phone ?? "").trim() || null;

  const openingBalance = Number(body.opening_balance ?? 0) || 0;
  const openingType =
    body.opening_balance_type === "PAYABLE" ? "PAYABLE" : "RECEIVABLE";
  const openingPaise = openingBalance > 0 ? toPaise(openingBalance) : 0;

  try {
    const create = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO parties
             (name, gstin, billing_address, shipping_address, state_code, phone,
              opening_balance_paise, opening_balance_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          name,
          gstin,
          billingAddress,
          shippingAddress,
          stateCode,
          phone,
          openingPaise,
          openingType
        );
      const partyId = Number(info.lastInsertRowid);

      if (openingPaise > 0) {
        postPartyOpening({
          date: today(),
          partyId,
          amount: openingPaise,
          type: openingType,
        });
      }
      return partyId;
    });
    const id = create();
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create party";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
