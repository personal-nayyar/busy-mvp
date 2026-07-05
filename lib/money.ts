/**
 * Money helpers. Ported from khata's Money.java principle: monetary math is never
 * done in floating point at rest. Every amount is stored as an INTEGER number of
 * paise (1 rupee = 100 paise). JS integers are exact well beyond any MSME amount,
 * so integer paise arithmetic is exact. Rounding is HALF_UP, matching GST invoice
 * presentation rules.
 */

export const PAISE_PER_RUPEE = 100;

/** Round a (possibly fractional) value to the nearest integer, HALF_UP, away from zero. */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) throw new Error("roundHalfUp: non-finite value");
  // +1e-9 nudges values that are a hair below .5 due to float error back up.
  return Math.sign(value) * Math.round(Math.abs(value) + 1e-9);
}

/** Parse a rupee amount (number or string) into integer paise. */
export function toPaise(value: number | string): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (n == null || Number.isNaN(n)) return 0;
  return roundHalfUp(n * PAISE_PER_RUPEE);
}

/** Integer paise -> rupees as a number with 2dp of precision. */
export function toRupees(paise: number): number {
  return roundHalfUp(paise) / PAISE_PER_RUPEE;
}

/** Integer paise -> plain 2dp string, e.g. "1180.00". */
export function rupeeString(paise: number): string {
  return (roundHalfUp(paise) / PAISE_PER_RUPEE).toFixed(2);
}

/**
 * Round a paise amount to the nearest whole rupee (HALF_UP) and return it in paise.
 * Used for invoice-level rounding (the "rounding" line on a GST invoice).
 */
export function toWholeRupeePaise(paise: number): number {
  return roundHalfUp(paise / PAISE_PER_RUPEE) * PAISE_PER_RUPEE;
}

/** Indian-grouped currency string, e.g. "₹1,23,456.00". */
export function formatINR(paise: number): string {
  const rupees = roundHalfUp(paise) / PAISE_PER_RUPEE;
  return (
    "₹" +
    rupees.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
