/**
 * GST calculation engine — a pure function (no I/O, no DB). Ported from the design
 * of khata's gst-engine contracts.
 *
 * Rule: intra-state supply (supplier state == place-of-supply state) is taxed as
 * CGST + SGST, each at half the item's GST rate. Inter-state supply is taxed as a
 * single IGST at the full rate. All monetary values are INTEGER paise; gstRate is a
 * percentage number (e.g. 18 for 18%). Per-component amounts are rounded HALF_UP to
 * whole paise, and the invoice grand total is rounded to the nearest whole rupee.
 */

import { roundHalfUp, toWholeRupeePaise } from "./money";

export interface GstLineInput {
  /** Net taxable value of the line in paise (already net of discount). */
  taxableValue: number;
  /** Total GST rate as a percentage, e.g. 18 for 18%. */
  gstRate: number;
}

export interface GstLineTax {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface GstResult {
  lines: GstLineTax[];
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  /** Invoice-level rounding adjustment in paise (may be negative). */
  rounding: number;
  /** taxable + tax + rounding, rounded to the nearest rupee. */
  grandTotal: number;
}

export interface GstRequest {
  supplierState: string;
  placeOfSupply: string;
  lines: GstLineInput[];
}

/** Intra-state (CGST+SGST) vs inter-state (IGST). Equal state codes => intra-state. */
export function isInterState(supplierState: string, placeOfSupply: string): boolean {
  if (!supplierState || !placeOfSupply) return false;
  return supplierState !== placeOfSupply;
}

export function calculateGst(req: GstRequest): GstResult {
  const interState = isInterState(req.supplierState, req.placeOfSupply);

  const lines: GstLineTax[] = req.lines.map((line) => {
    const taxable = roundHalfUp(line.taxableValue);
    const rate = line.gstRate ?? 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (interState) {
      igst = roundHalfUp((taxable * rate) / 100);
    } else {
      // CGST and SGST are each half the rate, and equal by construction.
      cgst = roundHalfUp((taxable * (rate / 2)) / 100);
      sgst = cgst;
    }

    const total = taxable + cgst + sgst + igst;
    return { taxable, cgst, sgst, igst, total };
  });

  const totalTaxable = lines.reduce((s, l) => s + l.taxable, 0);
  const totalCgst = lines.reduce((s, l) => s + l.cgst, 0);
  const totalSgst = lines.reduce((s, l) => s + l.sgst, 0);
  const totalIgst = lines.reduce((s, l) => s + l.igst, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;

  const preRounding = totalTaxable + totalTax;
  const grandTotal = toWholeRupeePaise(preRounding);
  const rounding = grandTotal - preRounding;

  return {
    lines,
    totalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax,
    rounding,
    grandTotal,
  };
}
