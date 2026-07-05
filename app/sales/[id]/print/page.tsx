import Link from "next/link";
import { notFound } from "next/navigation";
import db, { getCompany } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { stateName } from "@/lib/states";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

interface Invoice {
  id: number;
  number: string;
  date: string;
  place_of_supply: string;
  is_interstate: number;
  subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  rounding_paise: number;
  total_paise: number;
  notes: string | null;
  party_name: string;
  party_gstin: string | null;
  party_state_code: string;
  party_billing_address: string | null;
  party_shipping_address: string | null;
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

export default function SalesPrintPage({ params }: { params: { id: string } }) {
  const company = getCompany();
  const invoice = db
    .prepare(
      `SELECT i.*, p.name AS party_name, p.gstin AS party_gstin, p.state_code AS party_state_code,
              p.billing_address AS party_billing_address, p.shipping_address AS party_shipping_address
       FROM invoices i JOIN parties p ON p.id = i.party_id
       WHERE i.id = ? AND i.type = 'SALES'`
    )
    .get(Number(params.id)) as Invoice | undefined;
  if (!invoice) notFound();

  const lines = db
    .prepare("SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id")
    .all(invoice.id) as Line[];

  const interstate = invoice.is_interstate === 1;
  const colSpanLabel = interstate ? 7 : 8;

  return (
    <div className="invoice-print">
      <style>{`
        @media print {
          .sidebar, .no-print { display: none !important; }
          .main { padding: 0; max-width: none; }
          @page { margin: 12mm; }
        }
        .invoice-print { color: #1a2233; max-width: 800px; }
        .ip-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a2233; padding-bottom: 12px; margin-bottom: 16px; }
        .ip-company-name { font-size: 20px; font-weight: 700; }
        .ip-title { font-size: 22px; font-weight: 700; text-align: right; }
        .ip-meta { font-size: 12px; color: #5a6577; }
        .ip-parties { display: flex; gap: 24px; margin-bottom: 16px; }
        .ip-box { flex: 1; border: 1px solid #e3e8f0; border-radius: 8px; padding: 10px 12px; }
        .ip-box h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #5a6577; }
        .ip-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 16px; }
        .ip-table th, .ip-table td { border: 1px solid #e3e8f0; padding: 6px 8px; text-align: left; }
        .ip-table th { background: #f4f6fb; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
        .ip-table .num { text-align: right; font-variant-numeric: tabular-nums; }
        .ip-totals { width: 300px; margin-left: auto; border-collapse: collapse; font-size: 13px; }
        .ip-totals td { padding: 5px 8px; }
        .ip-totals .num { text-align: right; font-variant-numeric: tabular-nums; }
        .ip-totals .grand td { font-weight: 700; border-top: 2px solid #1a2233; font-size: 15px; }
      `}</style>

      <div className="toolbar no-print">
        <PrintButton />
        <Link href={`/sales/${invoice.id}`} className="btn btn-secondary no-print">
          Back
        </Link>
      </div>

      <div className="ip-head">
        <div>
          <div className="ip-company-name">{company.name}</div>
          <div className="ip-meta">
            {company.gstin && <div>GSTIN: {company.gstin}</div>}
            <div>
              State: {company.state_code} — {stateName(company.state_code)}
            </div>
            {company.address && <div>{company.address}</div>}
            {company.phone && <div>Phone: {company.phone}</div>}
          </div>
        </div>
        <div>
          <div className="ip-title">Tax Invoice</div>
          <div className="ip-meta" style={{ textAlign: "right" }}>
            <div>
              <strong>{invoice.number}</strong>
            </div>
            <div>Date: {formatDate(invoice.date)}</div>
            <div>
              Place of Supply: {invoice.place_of_supply} — {stateName(invoice.place_of_supply)}
            </div>
          </div>
        </div>
      </div>

      <div className="ip-parties">
        <div className="ip-box">
          <h4>Bill To</h4>
          <div>
            <strong>{invoice.party_name}</strong>
          </div>
          {invoice.party_billing_address && <div>{invoice.party_billing_address}</div>}
          {invoice.party_gstin && <div>GSTIN: {invoice.party_gstin}</div>}
          <div>
            State: {invoice.party_state_code} — {stateName(invoice.party_state_code)}
          </div>
        </div>
        <div className="ip-box">
          <h4>Ship To</h4>
          <div>
            <strong>{invoice.party_name}</strong>
          </div>
          <div>
            {invoice.party_shipping_address || invoice.party_billing_address || "—"}
          </div>
          <div>
            State: {invoice.party_state_code} — {stateName(invoice.party_state_code)}
          </div>
        </div>
      </div>

      <table className="ip-table">
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
              <td className="num">{l.qty}</td>
              <td className="num">{formatINR(l.rate_paise)}</td>
              <td className="num">{formatINR(l.taxable_paise)}</td>
              {interstate ? (
                <td className="num">{formatINR(l.igst_paise)}</td>
              ) : (
                <>
                  <td className="num">{formatINR(l.cgst_paise)}</td>
                  <td className="num">{formatINR(l.sgst_paise)}</td>
                </>
              )}
              <td className="num">{formatINR(l.line_total_paise)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="num" colSpan={colSpanLabel} style={{ fontWeight: 700 }}>
              Total
            </td>
            <td className="num" style={{ fontWeight: 700 }}>
              {formatINR(invoice.total_paise)}
            </td>
          </tr>
        </tfoot>
      </table>

      <table className="ip-totals">
        <tbody>
          <tr>
            <td>Taxable</td>
            <td className="num">{formatINR(invoice.subtotal_paise)}</td>
          </tr>
          {interstate ? (
            <tr>
              <td>IGST</td>
              <td className="num">{formatINR(invoice.igst_paise)}</td>
            </tr>
          ) : (
            <>
              <tr>
                <td>CGST</td>
                <td className="num">{formatINR(invoice.cgst_paise)}</td>
              </tr>
              <tr>
                <td>SGST</td>
                <td className="num">{formatINR(invoice.sgst_paise)}</td>
              </tr>
            </>
          )}
          <tr>
            <td>Rounding</td>
            <td className="num">{formatINR(invoice.rounding_paise)}</td>
          </tr>
          <tr className="grand">
            <td>Grand Total</td>
            <td className="num">{formatINR(invoice.total_paise)}</td>
          </tr>
        </tbody>
      </table>

      {invoice.notes && (
        <div style={{ marginTop: 16, fontSize: 12 }}>
          <strong>Notes:</strong> {invoice.notes}
        </div>
      )}
    </div>
  );
}
