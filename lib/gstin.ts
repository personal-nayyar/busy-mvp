/**
 * Pure GSTIN format + checksum validation (no network / GST-portal call).
 * Ported verbatim from khata's GstinValidator.java.
 *
 * A GSTIN is 15 chars: 2-digit state code, 10-char PAN, 1 entity code, the literal
 * 'Z', and a checksum character. The checksum uses the standard base-36 GSTIN
 * algorithm (factor alternates 1,2; sum of quotient+remainder of each product,
 * mod 36; check char = (36 - mod) % 36).
 */

const CODE_POINTS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function computeCheckDigit(first14: string): string {
  let factor = 1;
  let sum = 0;
  for (let i = 0; i < first14.length; i++) {
    const code = CODE_POINTS.indexOf(first14[i]);
    const product = code * factor;
    sum += Math.floor(product / CODE_POINTS.length) + (product % CODE_POINTS.length);
    factor = factor === 1 ? 2 : 1;
  }
  const checkIndex = (CODE_POINTS.length - (sum % CODE_POINTS.length)) % CODE_POINTS.length;
  return CODE_POINTS[checkIndex];
}

export function isValidGstin(gstin: string | null | undefined): boolean {
  if (!gstin || gstin.length !== 15) return false;
  const g = gstin.toUpperCase();
  if (!FORMAT.test(g)) return false;
  return computeCheckDigit(g.substring(0, 14)) === g[14];
}

/** State code is the first two digits of a GSTIN. */
export function gstinStateCode(gstin: string): string {
  if (!gstin || gstin.length < 2) {
    throw new Error("GSTIN too short to contain a state code");
  }
  return gstin.substring(0, 2);
}
