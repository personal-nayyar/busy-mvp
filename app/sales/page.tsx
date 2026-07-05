import Link from "next/link";
import db from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/date";

export const dynamic = "force-dynamic";

interface Row {
  id: number;
  number: string;
  date: string;
  party_name: string;
  subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
}

const STATUS_BADGE: Record<Row["status"], string> = {
  PAID: "badge-good",
  PARTIAL: "badge-warn",
  UNPAID: "badge-muted",
};

export default function SalesListPage() {
  const rows = db
    .prepare(
      `SELECT i.id, i.number, i.date, i.subtotal_paise, i.cgst_paise, i.sgst_paise,
              i.igst_paise, i.total_paise, i.status, p.name AS party_name
       FROM invoices i
       JOIN parties p ON p.id = i.party_id
       WHERE i.type = 'SALES'
       ORDER BY i.date DESC, i.id DESC`
    )
    .all() as Row[];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Invoices</h1>
          <p className="page-subtitle">Tax invoices raised to customers.</p>
        </div>
        <Link href="/sales/new" className="btn">
          + New Invoice
        </Link>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">No sales invoices yet. Create your first one.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="num">Taxable</th>
                <th className="num">Tax</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tax = r.cgst_paise + r.sgst_paise + r.igst_paise;
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/sales/${r.id}`}>{r.number}</Link>
                    </td>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.party_name}</td>
                    <td className="num mono">{formatINR(r.subtotal_paise)}</td>
                    <td className="num mono">{formatINR(tax)}</td>
                    <td className="num mono">{formatINR(r.total_paise)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="num">
                      <Link href={`/sales/${r.id}`} className="btn btn-secondary btn-sm">
                        View
                      </Link>{" "}
                      <Link href={`/sales/${r.id}/print`} className="btn btn-secondary btn-sm">
                        Print
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
