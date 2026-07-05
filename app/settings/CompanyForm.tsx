"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATES } from "@/lib/states";

export interface CompanyFormData {
  name: string;
  gstin: string;
  state_code: string;
  address: string;
  phone: string;
}

export default function CompanyForm({ initial }: { initial: CompanyFormData }) {
  const router = useRouter();
  const [form, setForm] = useState<CompanyFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof CompanyFormData>(key: K, value: CompanyFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        setSaving(false);
        return;
      }
      setMessage("Company settings saved.");
      setSaving(false);
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
        {message && (
          <p className="muted" style={{ marginTop: 0 }}>
            {message}
          </p>
        )}
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="name">Company Name *</label>
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
            <span className="muted" style={{ fontSize: 12 }}>
              Supplier state — drives CGST/SGST vs IGST on invoices.
            </span>
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
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              rows={3}
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </form>
  );
}
