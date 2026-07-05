/** Date helpers. Dates are stored as ISO "YYYY-MM-DD" strings throughout. */

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function firstOfMonth(iso: string = today()): string {
  return iso.slice(0, 8) + "01";
}

/** Format an ISO date as "05 Jul 2026". Returns the input unchanged if unparseable. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
