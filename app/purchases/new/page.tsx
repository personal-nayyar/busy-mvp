import Link from "next/link";
import db, { getCompany } from "@/lib/db";
import { today } from "@/lib/date";
import InvoiceForm, { FormParty, FormItem } from "../../sales/InvoiceForm";

export const dynamic = "force-dynamic";

export default function NewPurchaseBillPage() {
  const company = getCompany();
  const parties = db
    .prepare("SELECT id, name, state_code FROM parties ORDER BY name")
    .all() as FormParty[];
  const items = db
    .prepare(
      "SELECT id, name, hsn_sac, gst_rate, sale_price_paise, purchase_price_paise FROM items ORDER BY name"
    )
    .all() as FormItem[];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Purchase Bill</h1>
          <p className="page-subtitle">Record a bill received from a supplier.</p>
        </div>
        <Link href="/purchases" className="btn btn-secondary">
          Back to list
        </Link>
      </div>

      {parties.length === 0 ? (
        <div className="card">
          <div className="empty">
            No parties found. Please add a supplier first before recording a bill.
          </div>
        </div>
      ) : (
        <InvoiceForm
          kind="PURCHASE"
          companyStateCode={company.state_code}
          parties={parties}
          items={items}
          today={today()}
        />
      )}
    </div>
  );
}
