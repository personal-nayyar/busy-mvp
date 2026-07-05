import Link from "next/link";
import db, { getCompany } from "@/lib/db";
import { today } from "@/lib/date";
import InvoiceForm, { FormParty, FormItem } from "../InvoiceForm";

export const dynamic = "force-dynamic";

export default function NewSalesInvoicePage() {
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
          <h1 className="page-title">New Sales Invoice</h1>
          <p className="page-subtitle">Raise a tax invoice for a customer.</p>
        </div>
        <Link href="/sales" className="btn btn-secondary">
          Back to list
        </Link>
      </div>

      {parties.length === 0 ? (
        <div className="card">
          <div className="empty">
            No parties found. Please add a customer first before raising an invoice.
          </div>
        </div>
      ) : (
        <InvoiceForm
          kind="SALES"
          companyStateCode={company.state_code}
          parties={parties}
          items={items}
          today={today()}
        />
      )}
    </div>
  );
}
