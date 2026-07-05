import { balanceSheet } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { formatDate, today } from "@/lib/date";

export const dynamic = "force-dynamic";

export default function BalanceSheetPage({
  searchParams,
}: {
  searchParams: { to?: string };
}) {
  const asOf = searchParams.to || today();
  const { assets, liabilities, equity, totalAssets, totalLiabEquity, difference } =
    balanceSheet(asOf);
  const balanced = difference === 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Balance Sheet</h1>
          <p className="page-subtitle">As on {formatDate(asOf)}</p>
        </div>
      </div>

      <form method="get" className="toolbar">
        <div className="field">
          <label htmlFor="to">As on</label>
          <input type="date" id="to" name="to" defaultValue={asOf} />
        </div>
        <button type="submit" className="btn">Apply</button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Liabilities + Equity */}
        <div className="card">
          <h2 className="card-title">Liabilities &amp; Equity</h2>
          <table className="table">
            <tbody>
              {liabilities.map((r, i) => (
                <tr key={`l-${i}`}>
                  <td>{r.name}</td>
                  <td className="num">{formatINR(r.amount)}</td>
                </tr>
              ))}
              {equity.map((r, i) => (
                <tr key={`e-${i}`}>
                  <td>{r.name}</td>
                  <td className="num">{formatINR(r.amount)}</td>
                </tr>
              ))}
              {liabilities.length === 0 && equity.length === 0 ? (
                <tr>
                  <td colSpan={2} className="muted">Nothing to show.</td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr>
                <td>Total Liabilities &amp; Equity</td>
                <td className="num">{formatINR(totalLiabEquity)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Assets */}
        <div className="card">
          <h2 className="card-title">Assets</h2>
          <table className="table">
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={2} className="muted">Nothing to show.</td>
                </tr>
              ) : (
                assets.map((r, i) => (
                  <tr key={`a-${i}`}>
                    <td>{r.name}</td>
                    <td className="num">{formatINR(r.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Total Assets</td>
                <td className="num">{formatINR(totalAssets)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card">
        {balanced ? (
          <span className="badge badge-good">Balanced — Assets = Liabilities + Equity</span>
        ) : (
          <div>
            <span className="badge badge-bad">Out of balance</span>
            <table className="table" style={{ marginTop: 12 }}>
              <tbody>
                <tr>
                  <td>Difference (Assets − Liabilities &amp; Equity)</td>
                  <td className="num neg">{formatINR(difference)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
