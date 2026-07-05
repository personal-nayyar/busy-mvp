import Link from "next/link";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/date";

export const dynamic = "force-dynamic";

interface AccountRow {
  id: number;
  name: string;
  type: string;
}

interface EntryRow {
  id: number;
  date: string;
  number: string;
  type: string;
  narration: string | null;
  party_name: string | null;
  debit_paise: number;
  credit_paise: number;
}

/** Absolute paise with a Dr/Cr suffix. Debit-positive convention. */
function drCr(paise: number): string {
  if (paise === 0) return formatINR(0);
  return paise > 0 ? `${formatINR(paise)} Dr` : `${formatINR(-paise)} Cr`;
}

export default function AccountLedgerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}) {
  const accountId = Number(params.id);
  const account = db
    .prepare("SELECT id, name, type FROM accounts WHERE id = ?")
    .get(accountId) as AccountRow | undefined;
  if (!account) notFound();

  const from = (searchParams.from ?? "").trim();
  const to = (searchParams.to ?? "").trim();

  const conditions = ["le.account_id = ?"];
  const args: (number | string)[] = [accountId];
  if (from) {
    conditions.push("v.date >= ?");
    args.push(from);
  }
  if (to) {
    conditions.push("v.date <= ?");
    args.push(to);
  }

  const entries = db
    .prepare(
      `SELECT le.id, v.date, v.number, v.type, v.narration,
              p.name AS party_name, le.debit_paise, le.credit_paise
         FROM ledger_entries le
         JOIN vouchers v ON v.id = le.voucher_id
         LEFT JOIN parties p ON p.id = le.party_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY v.date ASC, le.id ASC`
    )
    .all(...args) as EntryRow[];

  let running = 0;
  const rows = entries.map((e) => {
    running += e.debit_paise - e.credit_paise;
    return { ...e, running };
  });

  const totalDr = entries.reduce((s, e) => s + e.debit_paise, 0);
  const totalCr = entries.reduce((s, e) => s + e.credit_paise, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{account.name}</h1>
          <p className="page-subtitle">
            <span className="badge badge-muted">{account.type}</span> · Account ledger
          </p>
        </div>
        <Link className="btn btn-secondary" href="/ledgers">
          All ledgers
        </Link>
      </div>

      <form className="toolbar" method="get">
        <div className="field">
          <label htmlFor="from">From</label>
          <input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <button className="btn btn-secondary btn-sm" type="submit">
          Apply
        </button>
        {(from || to) && (
          <Link className="btn btn-secondary btn-sm" href={`/ledgers/account/${account.id}`}>
            Clear
          </Link>
        )}
      </form>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">No entries for this account in the selected range.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Number</th>
                <th>Type</th>
                <th>Particulars</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.number}</td>
                  <td>{r.type}</td>
                  <td>{r.party_name ?? r.narration ?? "—"}</td>
                  <td className="num">{r.debit_paise ? formatINR(r.debit_paise) : ""}</td>
                  <td className="num">{r.credit_paise ? formatINR(r.credit_paise) : ""}</td>
                  <td className="num">{drCr(r.running)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Closing balance</td>
                <td className="num">{formatINR(totalDr)}</td>
                <td className="num">{formatINR(totalCr)}</td>
                <td className="num">{drCr(running)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
