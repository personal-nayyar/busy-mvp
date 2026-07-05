import PartyForm from "../PartyForm";

export const dynamic = "force-dynamic";

export default function NewPartyPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Party</h1>
          <p className="page-subtitle">Add a customer or supplier</p>
        </div>
      </div>

      <PartyForm
        initial={{
          name: "",
          gstin: "",
          billing_address: "",
          shipping_address: "",
          state_code: "",
          phone: "",
          opening_balance: "0",
          opening_balance_type: "RECEIVABLE",
        }}
      />
    </div>
  );
}
