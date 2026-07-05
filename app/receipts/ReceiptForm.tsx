"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface PartyOption {
  id: number;
  name: string;
}

export interface InvoiceOption {
  id: number;
  party_id: number;
  number: string;
  date: string;
  total_paise: number;
  amount_paid_paise: number;
  outstanding_paise: number;
  outstanding_display: string;
}

export default function ReceiptForm({
  parties,
  invoices,
  today,
}: {
  parties: PartyOption[];
  invoices: InvoiceOption[];
  today: string;
}) {
  const router = useRouter();
  const [partyId, setPartyId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState<"CASH" | "BANK">("CASH");
  const [date, setDate] = useState(today);
  const [narration, setNarration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only outstanding invoices belonging to the selected party.
  const partyInvoices = useMemo(
    () => (partyId ? invoices.filter((inv) => String(inv.party_id) === partyId) : []),
    [partyId, invoices]
  );

  function onPartyChange(value: string) {
    setPartyId(value);
    setInvoiceId(""); // reset the linked invoice when the party changes
  }

  function onInvoiceChange(value: string) {
    setInvoiceId(value);
    // Prefill the amount with the invoice's outstanding balance for convenience.
    const inv = invoices.find((i) => String(i.id) === value);
    if (inv) setAmount((inv.outstanding_paise / 100).toFixed(2));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!partyId) return setError("Please select a customer.");
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Amount must be greater than zero.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "RECEIPT",
          party_id: Number(partyId),
          invoice_id: invoiceId ? Number(invoiceId) : null,
          amount: amt,
          account,
          date,
          narration,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to record receipt.");
        setSubmitting(false);
        return;
      }
      router.push("/receipts");
      router.refresh();
    } catch {
      setError("Network error while recording receipt.");
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="card-title">Receipt details</div>
      {error && <div className="error">{error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="party">Customer</label>
          <select id="party" value={partyId} onChange={(e) => onPartyChange(e.target.value)}>
            <option value="">Select customer…</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="invoice">Against invoice (optional)</label>
          <select
            id="invoice"
            value={invoiceId}
            onChange={(e) => onInvoiceChange(e.target.value)}
            disabled={!partyId}
          >
            <option value="">On account (no invoice)</option>
            {partyInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.number} — outstanding {inv.outstanding_display}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="amount">Amount (₹)</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="field">
          <label htmlFor="account">Received into</label>
          <select
            id="account"
            value={account}
            onChange={(e) => setAccount(e.target.value as "CASH" | "BANK")}
          >
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field full">
          <label htmlFor="narration">Narration (optional)</label>
          <input
            id="narration"
            type="text"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="e.g. Cheque no. 001234"
          />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save Receipt"}
        </button>
        <a className="btn btn-secondary" href="/receipts">
          Cancel
        </a>
      </div>
    </form>
  );
}
