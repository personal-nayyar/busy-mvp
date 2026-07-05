import { getCompany } from "@/lib/db";
import CompanyForm from "./CompanyForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const company = getCompany();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Settings</h1>
          <p className="page-subtitle">Your business details used on invoices and returns</p>
        </div>
      </div>

      <CompanyForm
        initial={{
          name: company.name ?? "",
          gstin: company.gstin ?? "",
          state_code: company.state_code ?? "",
          address: company.address ?? "",
          phone: company.phone ?? "",
        }}
      />
    </div>
  );
}
