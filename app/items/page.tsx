import Link from "next/link";
import db from "@/lib/db";
import { formatINR } from "@/lib/money";

export const dynamic = "force-dynamic";

interface ItemRow {
  id: number;
  name: string;
  hsn_sac: string | null;
  gst_rate: number;
  uom: string;
  sale_price_paise: number;
  stock_qty: number;
  low_stock_threshold: number;
}

export default function ItemsPage() {
  const items = db
    .prepare("SELECT * FROM items ORDER BY name COLLATE NOCASE ASC")
    .all() as ItemRow[];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Items</h1>
          <p className="page-subtitle">Goods and services</p>
        </div>
        <Link href="/items/new" className="btn">
          + New Item
        </Link>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="empty">No items yet. Create your first item.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>HSN / SAC</th>
                <th className="num">GST %</th>
                <th>UOM</th>
                <th className="num">Sale Price</th>
                <th className="num">Current Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const low =
                  it.low_stock_threshold > 0 && it.stock_qty <= it.low_stock_threshold;
                return (
                  <tr key={it.id}>
                    <td>{it.name}</td>
                    <td className="mono">{it.hsn_sac ?? "—"}</td>
                    <td className="num">{it.gst_rate}%</td>
                    <td>{it.uom}</td>
                    <td className="num">{formatINR(it.sale_price_paise)}</td>
                    <td className="num">
                      {it.stock_qty}
                      {low && (
                        <>
                          {" "}
                          <span className="badge badge-warn">Low</span>
                        </>
                      )}
                    </td>
                    <td className="right">
                      <Link href={`/items/${it.id}`} className="btn btn-secondary btn-sm">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
