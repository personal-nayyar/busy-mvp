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

export default function PaymentForm({
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
  const [account, setAccount] = useState<"CASH" | "BANK">("BANK");
  const [date, setDate] = useState(today);
  const [narration, setNarration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only outstanding purchase bills belonging to the selected supplier.
  const partyInvoices = useMemo(
    () => (partyId ? invoices.filter((inv) => String(inv.party_id) === partyId) : []),
    [partyId, invoices]
  );

  function onPartyChange(value: string) {
    setPartyId(value);
    setInvoiceId(""); // reset the linked bill when the supplier changes
  }

  function onInvoiceChange(value: string) {
    setInvoiceId(value);
    // Prefill the amount with the bill's outstanding balance for convenience.
    const inv = invoices.find((i) => String(i.id) === value);
    if (inv) setAmount((inv.outstanding_paise / 100).toFixed(2));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!partyId) return setError("Please select a supplier.");
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Amount must be greater than zero.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "PAYMENT",
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
        setError(data.error ?? "Failed to record payment.");
        setSubmitting(false);
        return;
      }
      router.push("/payments");
      router.refresh();
    } catch {
      setError("Network error while recording payment.");
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="card-title">Payment details</div>
      {error && <div className="error">{error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="party">Supplier</label>
          <select id="party" value={partyId} onChange={(e) => onPartyChange(e.target.value)}>
            <option value="">Select supplier…</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="invoice">Against bill (optional)</label>
          <select
            id="invoice"
            value={invoiceId}
            onChange={(e) => onInvoiceChange(e.target.value)}
            disabled={!partyId}
          >
            <option value="">On account (no bill)</option>
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
          <label htmlFor="account">Paid from</label>
          <select
            id="account"
            value={account}
            onChange={(e) => setAccount(e.target.value as "CASH" | "BANK")}
          >
            <option value="BANK">Bank</option>
            <option value="CASH">Cash</option>
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
            placeholder="e.g. NEFT ref. 987654"
          />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save Payment"}
        </button>
        <a className="btn btn-secondary" href="/payments">
          Cancel
        </a>
      </div>
    </form>
  );
}
