import Link from "next/link";
import db from "@/lib/db";
import { stateName } from "@/lib/states";

export const dynamic = "force-dynamic";

interface AccountRow {
  id: number;
  code: string | null;
  name: string;
  type: string;
}

interface PartyRow {
  id: number;
  name: string;
  gstin: string | null;
  state_code: string;
}

export default function LedgersIndexPage() {
  const accounts = db
    .prepare("SELECT id, code, name, type FROM accounts ORDER BY code ASC, name COLLATE NOCASE ASC")
    .all() as AccountRow[];

  const parties = db
    .prepare("SELECT id, name, gstin, state_code FROM parties ORDER BY name COLLATE NOCASE ASC")
    .all() as PartyRow[];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ledgers</h1>
          <p className="page-subtitle">Drill into any account or party ledger.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Accounts</div>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.code ?? ""}</td>
                <td>
                  <Link href={`/ledgers/account/${a.id}`}>{a.name}</Link>
                </td>
                <td>
                  <span className="badge badge-muted">{a.type}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Parties</div>
        {parties.length === 0 ? (
          <div className="empty">No parties yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Party</th>
                <th>GSTIN</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/ledgers/party/${p.id}`}>{p.name}</Link>
                  </td>
                  <td className="mono">{p.gstin ?? "—"}</td>
                  <td>{stateName(p.state_code)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
