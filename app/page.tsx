// Dashboard — server component reading live data directly from SQLite.
import Link from "next/link";
import db, { getCompany, getAccountId } from "@/lib/db";
import { formatINR, roundHalfUp } from "@/lib/money";
import { today, firstOfMonth, formatDate } from "@/lib/date";
import { stateName } from "@/lib/states";

export const dynamic = "force-dynamic";

interface RecentInvoice {
  id: number;
  number: string;
  date: string;
  type: "SALES" | "PURCHASE";
  total_paise: number;
  status: string;
  party_name: string | null;
}

interface LowStockItem {
  id: number;
  name: string;
  stock_qty: number;
  low_stock_threshold: number;
}

function sumPaise(row: { v: number | null } | undefined): number {
  return row?.v ?? 0;
}

export default function Dashboard() {
  const company = getCompany();
  const iso = today();
  const monthStart = firstOfMonth(iso);

  // Tile 1 — Today's Sales: SUM(total_paise) of SALES invoices dated today.
  const todaysSales = sumPaise(
    db
      .prepare(
        "SELECT COALESCE(SUM(total_paise), 0) AS v FROM invoices WHERE type = 'SALES' AND date = ?"
      )
      .get(iso) as { v: number }
  );

  // Tile 2 — This Month's Sales: SUM(total_paise) of SALES invoices in [firstOfMonth, today].
  const monthSales = sumPaise(
    db
      .prepare(
        "SELECT COALESCE(SUM(total_paise), 0) AS v FROM invoices WHERE type = 'SALES' AND date BETWEEN ? AND ?"
      )
      .get(monthStart, iso) as { v: number }
  );

  // Tile 3 — Total Receivables: net DEBTORS balance from the ledger (debit - credit).
  const receivables = sumPaise(
    db
      .prepare(
        "SELECT COALESCE(SUM(debit_paise - credit_paise), 0) AS v FROM ledger_entries WHERE account_id = ?"
      )
      .get(getAccountId("DEBTORS")) as { v: number }
  );

  // Tile 4 — Total Payables: net CREDITORS balance from the ledger (credit - debit).
  const payables = sumPaise(
    db
      .prepare(
        "SELECT COALESCE(SUM(credit_paise - debit_paise), 0) AS v FROM ledger_entries WHERE account_id = ?"
      )
      .get(getAccountId("CREDITORS")) as { v: number }
  );

  // Tile 5 — Current Stock Value: SUM(roundHalfUp(stock_qty * purchase_price_paise)).
  const stockRows = db
    .prepare("SELECT stock_qty, purchase_price_paise FROM items")
    .all() as { stock_qty: number; purchase_price_paise: number }[];
  const stockValue = stockRows.reduce(
    (acc, r) => acc + roundHalfUp(r.stock_qty * r.purchase_price_paise),
    0
  );

  // Recent Invoices — last 8 of any type, newest first.
  const recentInvoices = db
    .prepare(
      `SELECT i.id, i.number, i.date, i.type, i.total_paise, i.status, p.name AS party_name
       FROM invoices i
       LEFT JOIN parties p ON p.id = i.party_id
       ORDER BY i.date DESC, i.id DESC
       LIMIT 8`
    )
    .all() as RecentInvoice[];

  // Low Stock — items with a threshold set that are at or below it.
  const lowStock = db
    .prepare(
      `SELECT id, name, stock_qty, low_stock_threshold
       FROM items
       WHERE low_stock_threshold > 0 AND stock_qty <= low_stock_threshold
       ORDER BY stock_qty ASC`
    )
    .all() as LowStockItem[];

  const subtitleParts = [company?.name, stateName(company?.state_code)].filter(Boolean);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">{subtitleParts.join(" · ")}</p>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Today&apos;s Sales</div>
          <div className="stat-value">{formatINR(todaysSales)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">This Month&apos;s Sales</div>
          <div className="stat-value">{formatINR(monthSales)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Receivables</div>
          <div className="stat-value">{formatINR(receivables)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Payables</div>
          <div className="stat-value">{formatINR(payables)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Current Stock Value</div>
          <div className="stat-value">{formatINR(stockValue)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Recent Invoices</div>
        {recentInvoices.length === 0 ? (
          <p className="empty">No invoices yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Number</th>
                <th>Type</th>
                <th>Party</th>
                <th className="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{formatDate(inv.date)}</td>
                  <td>{inv.number}</td>
                  <td>
                    <span className="badge">{inv.type}</span>
                  </td>
                  <td>{inv.party_name ?? "—"}</td>
                  <td className="num">{formatINR(inv.total_paise)}</td>
                  <td>{inv.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">Low Stock</div>
        {lowStock.length === 0 ? (
          <p className="empty">All items are well stocked.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Stock Qty</th>
                <th className="num">Threshold</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="num">{item.stock_qty}</td>
                  <td className="num">
                    <span className="badge badge-warn">{item.low_stock_threshold}</span>
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
