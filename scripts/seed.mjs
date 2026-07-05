// Seed realistic demo data through the running app's API (exercises the real GST +
// double-entry logic). Usage: node scripts/seed.mjs   (dev server must be running)
const BASE = process.env.BASE ?? "http://localhost:3000";

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}
const R = (rupees) => Math.round(rupees * 100); // rupees -> paise for line rate_paise

async function main() {
  // Company (supplier state = Maharashtra 27)
  await api("PUT", "/api/company", {
    name: "Sharma Electronics",
    state_code: "27",
    gstin: "27AAPFU0939F1ZV",
    address: "12 Lamington Road, Mumbai 400007",
    phone: "022-2345678",
  });

  // Parties
  const rajesh = (await api("POST", "/api/parties", { name: "Rajesh Traders", state_code: "27", billing_address: "Dadar, Mumbai", phone: "9820011111" })).id;
  const bengaluru = (await api("POST", "/api/parties", { name: "Bengaluru Gadgets", state_code: "29", billing_address: "MG Road, Bengaluru", phone: "9845022222" })).id;
  const delhi = (await api("POST", "/api/parties", { name: "Delhi Retail Hub", state_code: "07", billing_address: "Nehru Place, New Delhi", phone: "9811033333" })).id;
  const gujarat = (await api("POST", "/api/parties", { name: "Gujarat Components", state_code: "24", billing_address: "Surat, Gujarat", phone: "9925044444" })).id;
  const wholesale = (await api("POST", "/api/parties", { name: "Mumbai Wholesale", state_code: "27", billing_address: "Bhuleshwar, Mumbai", phone: "9867055555", opening_balance: 15000, opening_balance_type: "PAYABLE" })).id;

  // Items  (sale/purchase prices in rupees; opening stock; low-stock threshold)
  const led = (await api("POST", "/api/items", { name: 'LED Monitor 24"', hsn_sac: "8528", gst_rate: 18, uom: "NOS", sale_price: 8500, purchase_price: 6000, opening_stock_qty: 40, low_stock_threshold: 10 })).id;
  const kb = (await api("POST", "/api/items", { name: "Wireless Keyboard", hsn_sac: "8471", gst_rate: 18, uom: "NOS", sale_price: 1200, purchase_price: 750, opening_stock_qty: 120, low_stock_threshold: 20 })).id;
  const usbc = (await api("POST", "/api/items", { name: "USB-C Cable 1m", hsn_sac: "8544", gst_rate: 18, uom: "NOS", sale_price: 300, purchase_price: 150, opening_stock_qty: 8, low_stock_threshold: 15 })).id;
  const chair = (await api("POST", "/api/items", { name: "Office Chair", hsn_sac: "9401", gst_rate: 18, uom: "NOS", sale_price: 4500, purchase_price: 3000, opening_stock_qty: 25, low_stock_threshold: 5 })).id;
  const a4 = (await api("POST", "/api/items", { name: "A4 Paper Ream", hsn_sac: "4802", gst_rate: 12, uom: "REAM", sale_price: 320, purchase_price: 240, opening_stock_qty: 200, low_stock_threshold: 30 })).id;

  const line = (item_id, hsn_sac, qty, rateRupees, gst_rate) => ({ item_id, hsn_sac, qty, rate_paise: R(rateRupees), gst_rate });

  // Purchases (stock in)
  const p1 = await api("POST", "/api/invoices", { type: "PURCHASE", party_id: gujarat, date: "2026-07-01", lines: [line(led, "8528", 20, 6000, 18), line(kb, "8471", 50, 750, 18)] });
  await api("POST", "/api/invoices", { type: "PURCHASE", party_id: wholesale, date: "2026-07-02", lines: [line(a4, "4802", 100, 240, 12)] });

  // Sales
  const s1 = await api("POST", "/api/invoices", { type: "SALES", party_id: rajesh, date: "2026-07-02", lines: [line(led, "8528", 3, 8500, 18), line(kb, "8471", 5, 1200, 18)] });
  const s2 = await api("POST", "/api/invoices", { type: "SALES", party_id: bengaluru, date: "2026-07-03", lines: [line(usbc, "8544", 5, 300, 18), line(chair, "9401", 2, 4500, 18)] });
  await api("POST", "/api/invoices", { type: "SALES", party_id: delhi, date: "2026-07-04", lines: [line(led, "8528", 5, 8500, 18), line(a4, "4802", 20, 320, 12)] });
  await api("POST", "/api/invoices", { type: "SALES", party_id: rajesh, date: "2026-07-05", lines: [line(chair, "9401", 2, 4500, 18)] }); // today

  // Receipts / payments (partial + full)
  await api("POST", "/api/payments", { kind: "RECEIPT", party_id: rajesh, invoice_id: s1.id, amount: 20000, account: "BANK", date: "2026-07-03" });   // partial
  await api("POST", "/api/payments", { kind: "RECEIPT", party_id: bengaluru, invoice_id: s2.id, amount: 12390, account: "BANK", date: "2026-07-04" }); // full
  await api("POST", "/api/payments", { kind: "PAYMENT", party_id: gujarat, invoice_id: p1.id, amount: 50000, account: "BANK", date: "2026-07-03" });   // partial

  console.log("Seed complete: 1 company, 5 parties, 5 items, 2 purchases, 4 sales, 3 settlements.");
}
main().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });
