import db from "@/lib/db";
import { formatINR } from "@/lib/money";
import { today } from "@/lib/date";
import PaymentForm, { PartyOption, InvoiceOption } from "../PaymentForm";

export const dynamic = "force-dynamic";

export default function NewPaymentPage() {
  const parties = db
    .prepare("SELECT id, name FROM parties ORDER BY name COLLATE NOCASE ASC")
    .all() as PartyOption[];

  const rows = db
    .prepare(
      `SELECT id, party_id, number, date, total_paise, amount_paid_paise
         FROM invoices
        WHERE type = 'PURCHASE' AND status != 'PAID'
        ORDER BY date DESC, id DESC`
    )
    .all() as Omit<InvoiceOption, "outstanding_paise" | "outstanding_display">[];

  const invoices: InvoiceOption[] = rows.map((inv) => {
    const outstanding = inv.total_paise - inv.amount_paid_paise;
    return { ...inv, outstanding_paise: outstanding, outstanding_display: formatINR(outstanding) };
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Payment</h1>
          <p className="page-subtitle">Record money paid to a supplier.</p>
        </div>
        <a className="btn btn-secondary" href="/payments">
          Back to list
        </a>
      </div>
      <PaymentForm parties={parties} invoices={invoices} today={today()} />
    </div>
  );
}
