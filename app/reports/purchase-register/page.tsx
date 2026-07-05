import { purchaseRegister } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { formatDate, firstOfMonth, today } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function PurchaseRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from || firstOfMonth();
  const to = sp.to || today();
  const { rows, totals } = purchaseRegister(from, to);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Register</h1>
          <p className="page-subtitle">
            Purchase bills from {formatDate(from)} to {formatDate(to)}
          </p>
        </div>
      </div>

      <form method="get" className="toolbar">
        <div className="field">
          <label htmlFor="from">From</label>
          <input type="date" id="from" name="from" defaultValue={from} />
        </div>
        <div className="field">
          <label htmlFor="to">To</label>
          <input type="date" id="to" name="to" defaultValue={to} />
        </div>
        <button type="submit" className="btn">Apply</button>
      </form>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">No purchase bills in this period.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Date</th>
                <th>Party</th>
                <th className="num">Taxable</th>
                <th className="num">CGST</th>
                <th className="num">SGST</th>
                <th className="num">IGST</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.number}</td>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.party}</td>
                  <td className="num">{formatINR(r.taxable)}</td>
                  <td className="num">{formatINR(r.cgst)}</td>
                  <td className="num">{formatINR(r.sgst)}</td>
                  <td className="num">{formatINR(r.igst)}</td>
                  <td className="num">{formatINR(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total ({rows.length})</td>
                <td className="num">{formatINR(totals.taxable)}</td>
                <td className="num">{formatINR(totals.cgst)}</td>
                <td className="num">{formatINR(totals.sgst)}</td>
                <td className="num">{formatINR(totals.igst)}</td>
                <td className="num">{formatINR(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
