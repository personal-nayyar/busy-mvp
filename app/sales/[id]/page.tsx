import Link from "next/link";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { stateName } from "@/lib/states";

export const dynamic = "force-dynamic";

interface Invoice {
  id: number;
  number: string;
  date: string;
  type: string;
  place_of_supply: string;
  is_interstate: number;
  subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  rounding_paise: number;
  total_paise: number;
  amount_paid_paise: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  notes: string | null;
  voucher_id: number | null;
  party_name: string;
  party_gstin: string | null;
  party_state_code: string;
}

interface Line {
  id: number;
  description: string | null;
  hsn_sac: string | null;
  qty: number;
  rate_paise: number;
  gst_rate: number;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  line_total_paise: number;
}

const STATUS_BADGE: Record<Invoice["status"], string> = {
  PAID: "badge-good",
  PARTIAL: "badge-warn",
  UNPAID: "badge-muted",
};

export default async function SalesViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = db
    .prepare(
      `SELECT i.*, p.name AS party_name, p.gstin AS party_gstin, p.state_code AS party_state_code
       FROM invoices i JOIN parties p ON p.id = i.party_id
       WHERE i.id = ? AND i.type = 'SALES'`
    )
    .get(Number(id)) as Invoice | undefined;
  if (!invoice) notFound();

  const lines = db
    .prepare("SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id")
    .all(invoice.id) as Line[];

  const interstate = invoice.is_interstate === 1;
  const balance = invoice.total_paise - invoice.amount_paid_paise;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoice {invoice.number}</h1>
          <p className="page-subtitle">
            {formatDate(invoice.date)} ·{" "}
            <span className={`badge ${STATUS_BADGE[invoice.status]}`}>{invoice.status}</span>
          </p>
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <Link href={`/sales/${invoice.id}/print`} className="btn">
            Print
          </Link>
          <Link href="/sales" className="btn btn-secondary">
            Back to list
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="form-grid">
          <div className="field">
            <label>Customer</label>
            <div>{invoice.party_name}</div>
          </div>
          <div className="field">
            <label>GSTIN</label>
            <div>{invoice.party_gstin || "—"}</div>
          </div>
          <div className="field">
            <label>Place of Supply</label>
            <div>
              {invoice.place_of_supply} — {stateName(invoice.place_of_supply)}
            </div>
          </div>
          <div className="field">
            <label>Supply Type</label>
            <div>{interstate ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Line items</div>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>HSN/SAC</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Taxable</th>
              {interstate ? (
                <th className="num">IGST</th>
              ) : (
                <>
                  <th className="num">CGST</th>
                  <th className="num">SGST</th>
                </>
              )}
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id}>
                <td>{i + 1}</td>
                <td>{l.description || "—"}</td>
                <td>{l.hsn_sac || "—"}</td>
                <td className="num mono">{l.qty}</td>
                <td className="num mono">{formatINR(l.rate_paise)}</td>
                <td className="num mono">{formatINR(l.taxable_paise)}</td>
                {interstate ? (
                  <td className="num mono">
                    {formatINR(l.igst_paise)} <span className="muted">({l.gst_rate}%)</span>
                  </td>
                ) : (
                  <>
                    <td className="num mono">
                      {formatINR(l.cgst_paise)}{" "}
                      <span className="muted">({l.gst_rate / 2}%)</span>
                    </td>
                    <td className="num mono">
                      {formatINR(l.sgst_paise)}{" "}
                      <span className="muted">({l.gst_rate / 2}%)</span>
                    </td>
                  </>
                )}
                <td className="num mono">{formatINR(l.line_total_paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Totals</div>
        <table className="table">
          <tbody>
            <tr>
              <td>Taxable value</td>
              <td className="num mono">{formatINR(invoice.subtotal_paise)}</td>
            </tr>
            {interstate ? (
              <tr>
                <td>IGST</td>
                <td className="num mono">{formatINR(invoice.igst_paise)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td>CGST</td>
                  <td className="num mono">{formatINR(invoice.cgst_paise)}</td>
                </tr>
                <tr>
                  <td>SGST</td>
                  <td className="num mono">{formatINR(invoice.sgst_paise)}</td>
                </tr>
              </>
            )}
            <tr>
              <td>Rounding</td>
              <td className="num mono">{formatINR(invoice.rounding_paise)}</td>
            </tr>
            <tr>
              <td>Amount paid</td>
              <td className="num mono">{formatINR(invoice.amount_paid_paise)}</td>
            </tr>
            <tr>
              <td>Balance due</td>
              <td className="num mono">{formatINR(balance)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Grand Total</td>
              <td className="num mono">{formatINR(invoice.total_paise)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {invoice.notes && (
        <div className="card">
          <div className="card-title">Notes</div>
          <div>{invoice.notes}</div>
        </div>
      )}
    </div>
  );
}
