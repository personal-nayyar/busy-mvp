import { gstSummary } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { formatDate, firstOfMonth, today } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function GstSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from || firstOfMonth();
  const to = sp.to || today();
  const g = gstSummary(from, to);
  const payable = g.netPayable >= 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">GST Summary</h1>
          <p className="page-subtitle">
            Output tax vs input credit for {formatDate(from)} to {formatDate(to)}
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
        <table className="table">
          <thead>
            <tr>
              <th>Head</th>
              <th className="num">Output Tax (Liability)</th>
              <th className="num">Input Credit (ITC)</th>
              <th className="num">Net (Output − Input)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CGST</td>
              <td className="num">{formatINR(g.outputCgst)}</td>
              <td className="num">{formatINR(g.inputCgst)}</td>
              <td className="num">{formatINR(g.outputCgst - g.inputCgst)}</td>
            </tr>
            <tr>
              <td>SGST</td>
              <td className="num">{formatINR(g.outputSgst)}</td>
              <td className="num">{formatINR(g.inputSgst)}</td>
              <td className="num">{formatINR(g.outputSgst - g.inputSgst)}</td>
            </tr>
            <tr>
              <td>IGST</td>
              <td className="num">{formatINR(g.outputIgst)}</td>
              <td className="num">{formatINR(g.inputIgst)}</td>
              <td className="num">{formatINR(g.outputIgst - g.inputIgst)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="num">{formatINR(g.totalOutput)}</td>
              <td className="num">{formatINR(g.totalInput)}</td>
              <td className={`num ${payable ? "neg" : "pos"}`}>{formatINR(g.netPayable)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="muted" style={{ marginTop: 12 }}>
          {payable ? (
            <>
              Net GST <strong>payable</strong>:{" "}
              <span className="badge badge-warn">{formatINR(g.netPayable)}</span>
            </>
          ) : (
            <>
              Net input credit <strong>carried forward</strong>:{" "}
              <span className="badge badge-good">{formatINR(-g.netPayable)}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
