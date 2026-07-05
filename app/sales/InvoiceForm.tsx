"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateGst, isInterState } from "@/lib/gst";
import { toPaise, roundHalfUp, formatINR } from "@/lib/money";

export interface FormParty {
  id: number;
  name: string;
  state_code: string;
}

export interface FormItem {
  id: number;
  name: string;
  hsn_sac: string | null;
  gst_rate: number;
  sale_price_paise: number;
  purchase_price_paise: number;
}

interface LineRow {
  itemId: string;
  description: string;
  hsn_sac: string;
  gst_rate: string;
  qty: string;
  rate: string; // rupees, editable
}

function blankLine(): LineRow {
  return { itemId: "", description: "", hsn_sac: "", gst_rate: "0", qty: "1", rate: "0" };
}

export default function InvoiceForm({
  kind,
  companyStateCode,
  parties,
  items,
  today,
}: {
  kind: "SALES" | "PURCHASE";
  companyStateCode: string;
  parties: FormParty[];
  items: FormItem[];
  today: string;
}) {
  const router = useRouter();
  const isSales = kind === "SALES";

  const [partyId, setPartyId] = useState<string>("");
  const [date, setDate] = useState<string>(today);
  const [notes, setNotes] = useState<string>("");
  const [lines, setLines] = useState<LineRow[]>([blankLine()]);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const party = parties.find((p) => String(p.id) === partyId);
  const interstate = party ? isInterState(companyStateCode, party.state_code) : false;

  function updateLine(idx: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function onItemChange(idx: number, itemIdStr: string) {
    const it = items.find((i) => String(i.id) === itemIdStr);
    if (!it) {
      updateLine(idx, { itemId: "" });
      return;
    }
    const priceP = isSales ? it.sale_price_paise : it.purchase_price_paise;
    updateLine(idx, {
      itemId: itemIdStr,
      description: it.name,
      hsn_sac: it.hsn_sac ?? "",
      gst_rate: String(it.gst_rate),
      rate: (priceP / 100).toFixed(2),
    });
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
  }
  function removeLine(idx: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  // Live preview — same math the server uses.
  const preview = useMemo(() => {
    const gstLines = lines.map((l) => ({
      taxableValue: roundHalfUp((Number(l.qty) || 0) * toPaise(l.rate)),
      gstRate: Number(l.gst_rate) || 0,
    }));
    const supplierState = companyStateCode;
    const placeOfSupply = party ? party.state_code : companyStateCode;
    const result = calculateGst({ supplierState, placeOfSupply, lines: gstLines });
    return result;
  }, [lines, party, companyStateCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!partyId) {
      setError("Please select a party.");
      return;
    }
    const payloadLines = lines
      .filter((l) => (Number(l.qty) || 0) > 0)
      .map((l) => ({
        item_id: l.itemId ? Number(l.itemId) : null,
        description: l.description || null,
        hsn_sac: l.hsn_sac || null,
        qty: Number(l.qty) || 0,
        rate_paise: toPaise(l.rate),
        gst_rate: Number(l.gst_rate) || 0,
      }));
    if (payloadLines.length === 0) {
      setError("Add at least one line with quantity greater than zero.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: kind,
          party_id: Number(partyId),
          date,
          notes: notes || null,
          lines: payloadLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save.");
        setSubmitting(false);
        return;
      }
      const dest = isSales ? `/sales/${data.id}` : `/purchases/${data.id}`;
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="form-grid">
          <div className="field">
            <label>{isSales ? "Customer" : "Supplier"}</label>
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">— Select {isSales ? "customer" : "supplier"} —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field full">
            <span className="muted">
              {party
                ? interstate
                  ? "Inter-state supply → IGST"
                  : "Intra-state supply → CGST + SGST"
                : "Select a party to determine the tax type."}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Line items</div>
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>HSN/SAC</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">GST %</th>
              <th className="num">Taxable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const taxable = preview.lines[idx]?.taxable ?? 0;
              return (
                <tr key={idx}>
                  <td>
                    <select value={l.itemId} onChange={(e) => onItemChange(idx, e.target.value)}>
                      <option value="">— Custom —</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={l.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={l.hsn_sac}
                      onChange={(e) => updateLine(idx, { hsn_sac: e.target.value })}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={l.qty}
                      onChange={(e) => updateLine(idx, { qty: e.target.value })}
                      style={{ textAlign: "right", width: "80px" }}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={l.rate}
                      onChange={(e) => updateLine(idx, { rate: e.target.value })}
                      style={{ textAlign: "right", width: "100px" }}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={l.gst_rate}
                      onChange={(e) => updateLine(idx, { gst_rate: e.target.value })}
                      style={{ textAlign: "right", width: "70px" }}
                    />
                  </td>
                  <td className="num mono">{formatINR(taxable)}</td>
                  <td className="num">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="toolbar" style={{ marginTop: "12px" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
            + Add line
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Summary</div>
        <table className="table">
          <tbody>
            <tr>
              <td>Taxable value</td>
              <td className="num mono">{formatINR(preview.totalTaxable)}</td>
            </tr>
            {interstate ? (
              <tr>
                <td>IGST</td>
                <td className="num mono">{formatINR(preview.totalIgst)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td>CGST</td>
                  <td className="num mono">{formatINR(preview.totalCgst)}</td>
                </tr>
                <tr>
                  <td>SGST</td>
                  <td className="num mono">{formatINR(preview.totalSgst)}</td>
                </tr>
              </>
            )}
            <tr>
              <td>Rounding</td>
              <td className="num mono">{formatINR(preview.rounding)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Grand Total</td>
              <td className="num mono">{formatINR(preview.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card">
        <div className="field full">
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Saving…" : isSales ? "Save Invoice" : "Save Bill"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push(isSales ? "/sales" : "/purchases")}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
