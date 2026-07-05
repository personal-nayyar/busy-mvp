import { stockReport } from "@/lib/reports";
import { formatINR } from "@/lib/money";

export const dynamic = "force-dynamic";

export default function StockReportPage() {
  const { rows, totalValue } = stockReport();
  const lowCount = rows.filter((r) => r.lowStock).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Report</h1>
          <p className="page-subtitle">
            Current stock-in-hand valued at purchase price
            {lowCount > 0 ? ` — ${lowCount} item(s) low on stock` : ""}
          </p>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">No items defined.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>HSN/SAC</th>
                <th className="num">GST %</th>
                <th className="num">Qty</th>
                <th>UOM</th>
                <th className="num">Purchase Price</th>
                <th className="num">Stock Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mono">{r.hsnSac || "—"}</td>
                  <td className="num">{r.gstRate}%</td>
                  <td className="num">{r.stockQty}</td>
                  <td>{r.uom}</td>
                  <td className="num">{formatINR(r.purchasePrice)}</td>
                  <td className="num">{formatINR(r.stockValue)}</td>
                  <td>
                    {r.lowStock ? (
                      <span className="badge badge-warn">Low stock</span>
                    ) : (
                      <span className="badge badge-good">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>Total Stock Value ({rows.length} items)</td>
                <td className="num">{formatINR(totalValue)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
