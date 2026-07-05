import ItemForm from "../ItemForm";

export const dynamic = "force-dynamic";

export default function NewItemPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Item</h1>
          <p className="page-subtitle">Add a good or service</p>
        </div>
      </div>

      <ItemForm
        initial={{
          name: "",
          hsn_sac: "",
          gst_rate: "18",
          uom: "NOS",
          sale_price: "0",
          purchase_price: "0",
          opening_stock_qty: "0",
          low_stock_threshold: "0",
        }}
      />
    </div>
  );
}
