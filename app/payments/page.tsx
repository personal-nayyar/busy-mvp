import db from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/date";

export const dynamic = "force-dynamic";

interface PaymentRow {
  id: number;
  date: string;
  number: string;
  narration: string | null;
  total_paise: number;
  party_name: string | null;
}

export default function PaymentsPage() {
  const rows = db
    .prepare(
      `SELECT v.id, v.date, v.number, v.narration, v.total_paise, p.name AS party_name
         FROM vouchers v
         LEFT JOIN parties p ON p.id = v.party_id
        WHERE v.type = 'PAYMENT'
        ORDER BY v.date DESC, v.id DESC`
    )
    .all() as PaymentRow[];

  const total = rows.reduce((sum, r) => sum + r.total_paise, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Money paid to suppliers.</p>
        </div>
        <a className="btn" href="/payments/new">
          New Payment
        </a>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">No payments recorded yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Number</th>
                <th>Supplier</th>
                <th>Narration</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.number}</td>
                  <td>{r.party_name ?? "—"}</td>
                  <td className="muted">{r.narration ?? ""}</td>
                  <td className="num">{formatINR(r.total_paise)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td className="num">{formatINR(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
