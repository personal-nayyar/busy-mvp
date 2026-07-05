"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ItemFormData {
  id?: number;
  name: string;
  hsn_sac: string;
  gst_rate: string;
  uom: string;
  sale_price: string;
  purchase_price: string;
  opening_stock_qty: string;
  low_stock_threshold: string;
  /** Present on edit: current stock (read-only; moved by invoices). */
  stock_qty?: number;
}

const GST_RATES = ["0", "5", "12", "18", "28"];

export default function ItemForm({ initial }: { initial: ItemFormData }) {
  const router = useRouter();
  const isEdit = initial.id != null;

  const [form, setForm] = useState<ItemFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Show the "other" free-number rate field when the current rate isn't a preset.
  const [customRate, setCustomRate] = useState(
    isEdit && !GST_RATES.includes(initial.gst_rate)
  );

  function update<K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: form.name,
      hsn_sac: form.hsn_sac,
      gst_rate: Number(form.gst_rate) || 0,
      uom: form.uom,
      sale_price: Number(form.sale_price) || 0,
      purchase_price: Number(form.purchase_price) || 0,
      opening_stock_qty: Number(form.opening_stock_qty) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
    };

    const url = isEdit ? `/api/items/${initial.id}` : "/api/items";
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
      router.push("/items");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirm("Delete this item? This cannot be undone.")) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/items/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete item");
        setDeleting(false);
        return;
      }
      router.push("/items");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="name">Item Name *</label>
            <input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="hsn_sac">HSN / SAC</label>
            <input
              id="hsn_sac"
              value={form.hsn_sac}
              onChange={(e) => update("hsn_sac", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="uom">Unit (UOM)</label>
            <input
              id="uom"
              value={form.uom}
              onChange={(e) => update("uom", e.target.value)}
              placeholder="NOS"
            />
          </div>

          <div className="field">
            <label htmlFor="gst_rate">GST Rate (%)</label>
            {customRate ? (
              <input
                id="gst_rate"
                type="number"
                step="0.01"
                min="0"
                value={form.gst_rate}
                onChange={(e) => update("gst_rate", e.target.value)}
              />
            ) : (
              <select
                id="gst_rate"
                value={form.gst_rate}
                onChange={(e) => {
                  if (e.target.value === "__other") {
                    setCustomRate(true);
                    update("gst_rate", "");
                  } else {
                    update("gst_rate", e.target.value);
                  }
                }}
              >
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
                <option value="__other">Other…</option>
              </select>
            )}
          </div>

          <div className="field">
            <label htmlFor="low_stock_threshold">Low-Stock Threshold</label>
            <input
              id="low_stock_threshold"
              type="number"
              step="0.01"
              min="0"
              value={form.low_stock_threshold}
              onChange={(e) => update("low_stock_threshold", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="sale_price">Sale Price (₹)</label>
            <input
              id="sale_price"
              type="number"
              step="0.01"
              min="0"
              value={form.sale_price}
              onChange={(e) => update("sale_price", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="purchase_price">Purchase Price (₹)</label>
            <input
              id="purchase_price"
              type="number"
              step="0.01"
              min="0"
              value={form.purchase_price}
              onChange={(e) => update("purchase_price", e.target.value)}
            />
          </div>

          {isEdit ? (
            <div className="field">
              <label>Current Stock</label>
              <input value={`${form.stock_qty ?? 0} ${form.uom}`} readOnly disabled />
              <span className="muted" style={{ fontSize: 12 }}>
                Stock moves come from invoices and bills.
              </span>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="opening_stock_qty">Opening Stock Qty</label>
              <input
                id="opening_stock_qty"
                type="number"
                step="0.01"
                min="0"
                value={form.opening_stock_qty}
                onChange={(e) => update("opening_stock_qty", e.target.value)}
              />
              <span className="muted" style={{ fontSize: 12 }}>
                Valued at purchase price when posted.
              </span>
            </div>
          )}
        </div>

        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Item"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => router.push("/items")}
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
