import Link from "next/link";
import db from "@/lib/db";
import { formatINR } from "@/lib/money";
import { stateName } from "@/lib/states";

export const dynamic = "force-dynamic";

interface PartyRow {
  id: number;
  name: string;
  gstin: string | null;
  state_code: string;
  phone: string | null;
  opening_balance_paise: number;
  opening_balance_type: "RECEIVABLE" | "PAYABLE";
}

export default function PartiesPage() {
  const parties = db
    .prepare("SELECT * FROM parties ORDER BY name COLLATE NOCASE ASC")
    .all() as PartyRow[];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Parties</h1>
          <p className="page-subtitle">Customers and suppliers</p>
        </div>
        <Link href="/parties/new" className="btn">
          + New Party
        </Link>
      </div>

      <div className="card">
        {parties.length === 0 ? (
          <div className="empty">
            No parties yet. Create your first customer or supplier.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>GSTIN</th>
                <th>State</th>
                <th>Phone</th>
                <th className="num">Opening Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="mono">{p.gstin ?? "—"}</td>
                  <td>{stateName(p.state_code) || "—"}</td>
                  <td>{p.phone ?? "—"}</td>
                  <td className="num">
                    {p.opening_balance_paise > 0 ? (
                      <>
                        {formatINR(p.opening_balance_paise)}{" "}
                        <span className="badge badge-muted">
                          {p.opening_balance_type === "PAYABLE" ? "Cr" : "Dr"}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="right">
                    <Link href={`/parties/${p.id}`} className="btn btn-secondary btn-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
