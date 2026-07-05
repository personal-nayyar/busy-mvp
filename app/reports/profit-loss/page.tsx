import { profitAndLoss } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { formatDate, firstOfMonth, today } from "@/lib/date";

export const dynamic = "force-dynamic";

export default function ProfitLossPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const from = searchParams.from || firstOfMonth();
  const to = searchParams.to || today();
  const { income, expense, totalIncome, totalExpense, netProfit } = profitAndLoss(from, to);
  const profit = netProfit >= 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profit &amp; Loss</h1>
          <p className="page-subtitle">
            For the period {formatDate(from)} to {formatDate(to)}
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
        <h2 className="card-title">Income</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {income.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">No income in this period.</td>
              </tr>
            ) : (
              income.map((r, i) => (
                <tr key={i}>
                  <td className="mono">{r.code}</td>
                  <td>{r.name}</td>
                  <td className="num">{formatINR(r.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total Income</td>
              <td className="num">{formatINR(totalIncome)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card">
        <h2 className="card-title">Expenses</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expense.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">No expenses in this period.</td>
              </tr>
            ) : (
              expense.map((r, i) => (
                <tr key={i}>
                  <td className="mono">{r.code}</td>
                  <td>{r.name}</td>
                  <td className="num">{formatINR(r.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total Expenses</td>
              <td className="num">{formatINR(totalExpense)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card">
        <table className="table">
          <tfoot>
            <tr>
              <td>
                Net {profit ? "Profit" : "Loss"}{" "}
                <span className={profit ? "badge badge-good" : "badge badge-bad"}>
                  {profit ? "Profit" : "Loss"}
                </span>
              </td>
              <td className={`num ${profit ? "pos" : "neg"}`}>{formatINR(Math.abs(netProfit))}</td>
            </tr>
          </tfoot>
        </table>
        <p className="muted" style={{ marginTop: 12 }}>
          Note: This statement uses <strong>periodic inventory</strong> — purchases are expensed
          in full when incurred, with no automatic closing-stock adjustment. To reflect closing
          stock, pass a manual journal or read the Stock Report separately.
        </p>
      </div>
    </div>
  );
}
