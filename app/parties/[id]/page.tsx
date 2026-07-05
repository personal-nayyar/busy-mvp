import { notFound } from "next/navigation";
import db from "@/lib/db";
import { toRupees } from "@/lib/money";
import PartyForm from "../PartyForm";

export const dynamic = "force-dynamic";

interface PartyRow {
  id: number;
  name: string;
  gstin: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  state_code: string;
  phone: string | null;
  opening_balance_paise: number;
  opening_balance_type: "RECEIVABLE" | "PAYABLE";
}

export default async function EditPartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const party = db
    .prepare("SELECT * FROM parties WHERE id = ?")
    .get(id) as PartyRow | undefined;

  if (!party) notFound();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit Party</h1>
          <p className="page-subtitle">{party.name}</p>
        </div>
      </div>

      <PartyForm
        initial={{
          id: party.id,
          name: party.name,
          gstin: party.gstin ?? "",
          billing_address: party.billing_address ?? "",
          shipping_address: party.shipping_address ?? "",
          state_code: party.state_code,
          phone: party.phone ?? "",
          opening_balance: String(toRupees(party.opening_balance_paise)),
          opening_balance_type: party.opening_balance_type,
          opening_balance_paise: party.opening_balance_paise,
        }}
      />
    </div>
  );
}
