import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createInvoice } from "@/lib/invoices";

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

  const party = db.prepare("SELECT id FROM parties WHERE id = ?").get(body.party_id);
  if (!party) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }

  try {
    const { id, number } = createInvoice({
      type,
      party_id: body.party_id,
      date: body.date,
      notes: body.notes ?? null,
      lines,
    });
    return NextResponse.json({ id, number });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
