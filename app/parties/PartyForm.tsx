"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATES } from "@/lib/states";
import { formatINR } from "@/lib/money";

export interface PartyFormData {
  id?: number;
  name: string;
  gstin: string;
  billing_address: string;
  shipping_address: string;
  state_code: string;
  phone: string;
  opening_balance: string;
  opening_balance_type: "RECEIVABLE" | "PAYABLE";
  /** Present on edit: the already-posted opening balance in paise (read-only). */
  opening_balance_paise?: number;
}

export default function PartyForm({ initial }: { initial: PartyFormData }) {
  const router = useRouter();
  const isEdit = initial.id != null;

  const [form, setForm] = useState<PartyFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirm("Delete this party? This cannot be undone.")) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/parties/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete party");
        setDeleting(false);
        return;
      }
      router.push("/parties");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setDeleting(false);
    }
  }

  function update<K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: form.name,
      gstin: form.gstin,
      billing_address: form.billing_address,
      shipping_address: form.shipping_address,
      state_code: form.state_code,
      phone: form.phone,
      opening_balance: Number(form.opening_balance) || 0,
      opening_balance_type: form.opening_balance_type,
    };

    const url = isEdit ? `/api/parties/${initial.id}` : "/api/parties";
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        setSaving(false);
        return;
      }
      router.push("/parties");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="name">Party Name *</label>
            <input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="gstin">GSTIN</label>
            <input
              id="gstin"
              value={form.gstin}
              onChange={(e) => update("gstin", e.target.value.toUpperCase())}
              placeholder="15-digit GSTIN (optional)"
              maxLength={15}
            />
          </div>

          <div className="field">
            <label htmlFor="state_code">State *</label>
            <select
              id="state_code"
              value={form.state_code}
              onChange={(e) => update("state_code", e.target.value)}
              required
            >
              <option value="">Select state…</option>
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>

          <div className="field full">
            <label htmlFor="billing_address">Billing Address</label>
            <textarea
              id="billing_address"
              rows={2}
              value={form.billing_address}
              onChange={(e) => update("billing_address", e.target.value)}
            />
          </div>

          <div className="field full">
            <label htmlFor="shipping_address">Shipping Address</label>
            <textarea
              id="shipping_address"
              rows={2}
              value={form.shipping_address}
              onChange={(e) => update("shipping_address", e.target.value)}
            />
          </div>

          {isEdit ? (
            <div className="field">
              <label>Opening Balance</label>
              <input
                value={`${formatINR(initial.opening_balance_paise ?? 0)} (${
                  form.opening_balance_type === "PAYABLE" ? "Payable" : "Receivable"
                })`}
                readOnly
                disabled
              />
              <span className="muted" style={{ fontSize: 12 }}>
                Set once at creation and already posted.
              </span>
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="opening_balance">Opening Balance (₹)</label>
                <input
                  id="opening_balance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.opening_balance}
                  onChange={(e) => update("opening_balance", e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="opening_balance_type">Balance Type</label>
                <select
                  id="opening_balance_type"
                  value={form.opening_balance_type}
                  onChange={(e) =>
                    update(
                      "opening_balance_type",
                      e.target.value as "RECEIVABLE" | "PAYABLE"
                    )
                  }
                >
                  <option value="RECEIVABLE">Receivable (they owe us)</option>
                  <option value="PAYABLE">Payable (we owe them)</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Party"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => router.push("/parties")}
          >
            Cancel
          </button>
          {isEdit && (
            <button
              className="btn btn-danger"
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{ marginLeft: "auto" }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
