import { describe, it, expect } from "vitest";
import { calculateGst, isInterState } from "@/lib/gst";

describe("calculateGst — intra-state", () => {
  const result = calculateGst({
    supplierState: "27",
    placeOfSupply: "27",
    lines: [{ taxableValue: 100000, gstRate: 18 }],
  });

  it("splits tax into equal CGST + SGST with no IGST", () => {
    expect(result.totalCgst).toBe(9000);
    expect(result.totalSgst).toBe(9000);
    expect(result.totalIgst).toBe(0);
  });

  it("totals the tax and grand total correctly with zero rounding", () => {
    expect(result.totalTax).toBe(18000);
    expect(result.grandTotal).toBe(118000);
    expect(result.rounding).toBe(0);
  });

  it("has equal CGST and SGST on the line", () => {
    expect(result.lines[0].cgst).toBe(result.lines[0].sgst);
  });
});

describe("calculateGst — inter-state", () => {
  const result = calculateGst({
    supplierState: "27",
    placeOfSupply: "29",
    lines: [{ taxableValue: 100000, gstRate: 18 }],
  });

  it("charges a single IGST at the full rate", () => {
    expect(result.totalIgst).toBe(18000);
    expect(result.totalCgst).toBe(0);
    expect(result.totalSgst).toBe(0);
    expect(result.grandTotal).toBe(118000);
  });
});

describe("calculateGst — invoice rounding", () => {
  const result = calculateGst({
    supplierState: "27",
    placeOfSupply: "27",
    lines: [{ taxableValue: 100050, gstRate: 18 }],
  });

  it("rounds the grand total to a whole number of rupees", () => {
    expect(result.grandTotal % 100).toBe(0);
  });

  it("reports rounding as grandTotal - (taxable + tax)", () => {
    expect(result.rounding).toBe(
      result.grandTotal - (result.totalTaxable + result.totalTax)
    );
  });
});

describe("calculateGst — multi-line totals", () => {
  const result = calculateGst({
    supplierState: "27",
    placeOfSupply: "27",
    lines: [
      { taxableValue: 100000, gstRate: 18 },
      { taxableValue: 50000, gstRate: 12 },
    ],
  });

  it("sums taxable across lines", () => {
    expect(result.totalTaxable).toBe(150000);
  });

  it("sums CGST/SGST across lines", () => {
    // line1: 9000 each; line2: 12% -> 6% each = 3000 each
    expect(result.totalCgst).toBe(12000);
    expect(result.totalSgst).toBe(12000);
    expect(result.totalTax).toBe(24000);
  });

  it("line totals equal taxable + tax per line", () => {
    for (const line of result.lines) {
      expect(line.total).toBe(line.taxable + line.cgst + line.sgst + line.igst);
    }
  });
});

describe("isInterState", () => {
  it("is false for equal state codes", () => {
    expect(isInterState("27", "27")).toBe(false);
  });

  it("is true for differing state codes", () => {
    expect(isInterState("27", "29")).toBe(true);
  });
});
