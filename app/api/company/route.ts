import { NextResponse } from "next/server";
import db, { getCompany } from "@/lib/db";
import { isValidGstin } from "@/lib/gstin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/company — read the single company row. */
export function GET() {
  return NextResponse.json(getCompany());
}

/** PUT /api/company — update the single company row (id = 1). */
export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const stateCode = String(body.state_code ?? "").trim();
  if (!stateCode) {
    return NextResponse.json({ error: "State is required" }, { status: 400 });
  }

  const gstin: string | null = String(body.gstin ?? "").trim().toUpperCase() || null;
  if (gstin && !isValidGstin(gstin)) {
    return NextResponse.json({ error: "Invalid GSTIN" }, { status: 400 });
  }

  const address = String(body.address ?? "").trim() || null;
  const phone = String(body.phone ?? "").trim() || null;

  db.prepare(
    `UPDATE company
       SET name = ?, gstin = ?, state_code = ?, address = ?, phone = ?
     WHERE id = 1`
  ).run(name, gstin, stateCode, address, phone);

  return NextResponse.json(getCompany());
}
