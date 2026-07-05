import { dayBook } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { formatDate, firstOfMonth, today } from "@/lib/date";

export const dynamic = "force-dynamic";

export default function DayBookPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const from = searchParams.from || firstOfMonth();
  const to = searchParams.to || today();
  const vouchers = dayBook(from, to);

  const grandDebit = vouchers.reduce((s, v) => s + v.totalDebit, 0);
  const grandCredit = vouchers.reduce((s, v) => s + v.totalCredit, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Day Book</h1>
          <p className="page-subtitle">
            All vouchers from {formatDate(from)} to {formatDate(to)}
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
        {vouchers.length === 0 ? (
          <div className="empty">No vouchers in this period.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher</th>
                <th>Particulars</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <VoucherBlock key={v.voucherId} v={v} />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Grand Total ({vouchers.length} vouchers)</td>
                <td className="num">{formatINR(grandDebit)}</td>
                <td className="num">{formatINR(grandCredit)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

function VoucherBlock({
  v,
}: {
  v: ReturnType<typeof dayBook>[number];
}) {
  return (
    <>
      {v.lines.map((l, i) => (
        <tr key={`${v.voucherId}-${i}`}>
          <td>{i === 0 ? formatDate(v.date) : ""}</td>
          <td>
            {i === 0 ? (
              <>
                <span className="badge badge-muted">{v.type}</span> {v.number}
              </>
            ) : (
              ""
            )}
          </td>
          <td>
            {l.debit > 0 ? (
              <span>{l.accountName}</span>
            ) : (
              <span className="muted">&nbsp;&nbsp;&nbsp;&nbsp;To {l.accountName}</span>
            )}
            {i === 0 && v.party ? <span className="muted"> — {v.party}</span> : null}
          </td>
          <td className="num">{l.debit > 0 ? formatINR(l.debit) : ""}</td>
          <td className="num">{l.credit > 0 ? formatINR(l.credit) : ""}</td>
        </tr>
      ))}
      {v.narration ? (
        <tr>
          <td></td>
          <td></td>
          <td className="muted" colSpan={3}>
            <em>{v.narration}</em>
          </td>
        </tr>
      ) : null}
    </>
  );
}
