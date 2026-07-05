import { notFound } from "next/navigation";
import db from "@/lib/db";
import { toRupees } from "@/lib/money";
import ItemForm from "../ItemForm";

export const dynamic = "force-dynamic";

interface ItemRow {
  id: number;
  name: string;
  hsn_sac: string | null;
  gst_rate: number;
  uom: string;
  sale_price_paise: number;
  purchase_price_paise: number;
  opening_stock_qty: number;
  stock_qty: number;
  low_stock_threshold: number;
}

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = db
    .prepare("SELECT * FROM items WHERE id = ?")
    .get(id) as ItemRow | undefined;

  if (!item) notFound();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit Item</h1>
          <p className="page-subtitle">{item.name}</p>
        </div>
      </div>

      <ItemForm
        initial={{
          id: item.id,
          name: item.name,
          hsn_sac: item.hsn_sac ?? "",
          gst_rate: String(item.gst_rate),
          uom: item.uom,
          sale_price: String(toRupees(item.sale_price_paise)),
          purchase_price: String(toRupees(item.purchase_price_paise)),
          opening_stock_qty: String(item.opening_stock_qty),
          low_stock_threshold: String(item.low_stock_threshold),
          stock_qty: item.stock_qty,
        }}
      />
    </div>
  );
}
