import { describe, it, expect } from "vitest";
import { isValidGstin, gstinStateCode } from "@/lib/gstin";

describe("isValidGstin", () => {
  it("accepts a GSTIN with a correct checksum", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
  });

  it("rejects a GSTIN with a wrong check digit", () => {
    expect(isValidGstin("27AAPFU0939F1ZZ")).toBe(false);
  });

  it("rejects a GSTIN of the wrong length", () => {
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
  });

  it("upper-cases before validating so lowercase-but-valid passes", () => {
    expect(isValidGstin("27aapfu0939f1zv")).toBe(true);
  });

  it("rejects null / undefined", () => {
    expect(isValidGstin(null)).toBe(false);
    expect(isValidGstin(undefined)).toBe(false);
  });
});

describe("gstinStateCode", () => {
  it("returns the first two digits", () => {
    expect(gstinStateCode("27AAPFU0939F1ZV")).toBe("27");
  });
});
