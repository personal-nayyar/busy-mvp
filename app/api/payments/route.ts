import { NextResponse } from "next/server";
import db from "@/lib/db";
import { toPaise } from "@/lib/money";
import { today } from "@/lib/date";
import { postReceipt, postPayment } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Kind = "RECEIPT" | "PAYMENT";

interface InvoiceRow {
  id: number;
  party_id: number;
  type: "SALES" | "PURCHASE";
  total_paise: number;
  amount_paid_paise: number;
}

/**
 * GET /api/payments?kind=RECEIPT|PAYMENT — list receipt/payment vouchers.
 * Defaults to RECEIPT when kind is omitted or invalid.
 */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind: Kind = searchParams.get("kind") === "PAYMENT" ? "PAYMENT" : "RECEIPT";
  const rows = db
    .prepare(
      `SELECT v.id, v.date, v.number, v.narration, v.total_paise,
              p.id AS party_id, p.name AS party_name
         FROM vouchers v
         LEFT JOIN parties p ON p.id = v.party_id
        WHERE v.type = ?
        ORDER BY v.date DESC, v.id DESC`
    )
    .all(kind);
  return NextResponse.json(rows);
}

/**
 * POST /api/payments — record a RECEIPT (from a customer) or a PAYMENT (to a supplier).
 * Body: { kind, date, party_id, invoice_id?, amount (rupees), account:'CASH'|'BANK', narration? }
 * Posts the voucher and, if an invoice is linked, records the settlement and updates
 * the invoice's amount_paid / status — all inside ONE db.transaction.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const kind: Kind = body.kind === "PAYMENT" ? "PAYMENT" : body.kind === "RECEIPT" ? "RECEIPT" : (null as never);
  if (kind !== "RECEIPT" && kind !== "PAYMENT") {
    return NextResponse.json({ error: "kind must be RECEIPT or PAYMENT" }, { status: 400 });
  }

  const partyId = Number(body.party_id);
  if (!partyId || Number.isNaN(partyId)) {
    return NextResponse.json({ error: "Party is required" }, { status: 400 });
  }

  const account: "CASH" | "BANK" = body.account === "BANK" ? "BANK" : "CASH";
  const date = String(body.date ?? "").trim() || today();
  const narration = String(body.narration ?? "").trim() || null;

  const amountPaise = toPaise(Number(body.amount ?? 0) || 0);
  if (amountPaise <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  // Optional invoice link. Receipts settle SALES invoices; payments settle PURCHASE bills.
  const wantedInvoiceType = kind === "RECEIPT" ? "SALES" : "PURCHASE";
  let invoice: InvoiceRow | null = null;
  const invoiceIdRaw = body.invoice_id;
  if (invoiceIdRaw !== null && invoiceIdRaw !== undefined && String(invoiceIdRaw).trim() !== "") {
    const invoiceId = Number(invoiceIdRaw);
    if (!invoiceId || Number.isNaN(invoiceId)) {
      return NextResponse.json({ error: "Invalid invoice reference" }, { status: 400 });
    }
    invoice = db
      .prepare(
        `SELECT id, party_id, type, total_paise, amount_paid_paise FROM invoices WHERE id = ?`
      )
      .get(invoiceId) as InvoiceRow | undefined ?? null;
    if (!invoice) {
      return NextResponse.json({ error: "Linked invoice not found" }, { status: 400 });
    }
    if (invoice.type !== wantedInvoiceType) {
      return NextResponse.json(
        { error: `A ${kind.toLowerCase()} can only settle a ${wantedInvoiceType} document` },
        { status: 400 }
      );
    }
    if (invoice.party_id !== partyId) {
      return NextResponse.json(
        { error: "Linked invoice belongs to a different party" },
        { status: 400 }
      );
    }
    const outstanding = invoice.total_paise - invoice.amount_paid_paise;
    if (amountPaise > outstanding) {
      return NextResponse.json(
        { error: "Amount exceeds the invoice outstanding balance" },
        { status: 400 }
      );
    }
  }

  try {
    const run = db.transaction(() => {
      const posted =
        kind === "RECEIPT"
          ? postReceipt({ date, partyId, amount: amountPaise, account, narration: narration ?? undefined })
          : postPayment({ date, partyId, amount: amountPaise, account, narration: narration ?? undefined });

      if (invoice) {
        db.prepare(
          `INSERT INTO settlements (invoice_id, voucher_id, amount_paise, date)
           VALUES (?, ?, ?, ?)`
        ).run(invoice.id, posted.voucherId, amountPaise, date);

        const newPaid = invoice.amount_paid_paise + amountPaise;
        const status = newPaid >= invoice.total_paise ? "PAID" : newPaid > 0 ? "PARTIAL" : "UNPAID";
        db.prepare(
          `UPDATE invoices SET amount_paid_paise = ?, status = ? WHERE id = ?`
        ).run(newPaid, status, invoice.id);
      }
      return posted;
    });
    const posted = run();
    return NextResponse.json({ id: posted.voucherId, number: posted.number }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record voucher";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
