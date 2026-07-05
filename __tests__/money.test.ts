import { describe, it, expect } from "vitest";
import {
  toPaise,
  toRupees,
  rupeeString,
  toWholeRupeePaise,
  formatINR,
  roundHalfUp,
} from "@/lib/money";

describe("toPaise", () => {
  it("converts a whole-rupee number to paise", () => {
    expect(toPaise(1000)).toBe(100000);
  });

  it("parses a decimal string to paise", () => {
    expect(toPaise("99.99")).toBe(9999);
  });

  it("parses a whole-rupee string to paise", () => {
    expect(toPaise("1000")).toBe(100000);
  });

  it("returns 0 for non-numeric input", () => {
    expect(toPaise("abc")).toBe(0);
  });
});

describe("roundHalfUp", () => {
  it("rounds 0.5 up to 1 (HALF_UP)", () => {
    expect(roundHalfUp(0.5)).toBe(1);
  });

  it("rounds 2.5 up to 3 (HALF_UP, not banker's rounding)", () => {
    expect(roundHalfUp(2.5)).toBe(3);
  });

  it("rounds -0.5 to -1 (away from zero)", () => {
    expect(roundHalfUp(-0.5)).toBe(-1);
  });

  it("leaves whole numbers unchanged", () => {
    expect(roundHalfUp(5)).toBe(5);
  });
});

describe("toWholeRupeePaise", () => {
  it("rounds down when below the half-rupee mark", () => {
    expect(toWholeRupeePaise(118049)).toBe(118000);
  });

  it("rounds up at exactly the half-rupee mark (HALF_UP)", () => {
    expect(toWholeRupeePaise(118050)).toBe(118100);
  });
});

describe("formatINR", () => {
  it("formats with Indian digit grouping", () => {
    expect(formatINR(11800000)).toBe("₹1,18,000.00");
  });
});

describe("toRupees / rupeeString", () => {
  it("toRupees converts paise to a rupee number", () => {
    expect(toRupees(118000)).toBe(1180);
  });

  it("rupeeString renders a 2dp string", () => {
    expect(rupeeString(118000)).toBe("1180.00");
  });
});
