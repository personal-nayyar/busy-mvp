import { trialBalance } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { formatDate, today } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const sp = await searchParams;
  const asOf = sp.to || today();
  const { rows, totalDebit, totalCredit } = trialBalance(asOf);
  const balanced = totalDebit === totalCredit;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trial Balance</h1>
          <p className="page-subtitle">Closing balances as on {formatDate(asOf)}</p>
        </div>
      </div>

      <form method="get" className="toolbar">
        <div className="field">
          <label htmlFor="to">As on</label>
          <input type="date" id="to" name="to" defaultValue={asOf} />
        </div>
        <button type="submit" className="btn">Apply</button>
      </form>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">No ledger activity as on this date.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="mono">{r.code}</td>
                  <td>{r.name}</td>
                  <td className="num">{r.debit > 0 ? formatINR(r.debit) : ""}</td>
                  <td className="num">{r.credit > 0 ? formatINR(r.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  Total{" "}
                  <span className={balanced ? "badge badge-good" : "badge badge-bad"}>
                    {balanced ? "Balanced" : "Out of balance"}
                  </span>
                </td>
                <td className="num">{formatINR(totalDebit)}</td>
                <td className="num">{formatINR(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
