import Link from "next/link";

const SECTIONS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Overview",
    links: [{ href: "/", label: "Dashboard" }],
  },
  {
    heading: "Masters",
    links: [
      { href: "/parties", label: "Parties" },
      { href: "/items", label: "Items" },
    ],
  },
  {
    heading: "Transactions",
    links: [
      { href: "/sales", label: "Sales Invoices" },
      { href: "/purchases", label: "Purchase Bills" },
      { href: "/receipts", label: "Receipts" },
      { href: "/payments", label: "Payments" },
    ],
  },
  {
    heading: "Accounting",
    links: [
      { href: "/ledgers", label: "Ledgers" },
      { href: "/reports/day-book", label: "Day Book" },
    ],
  },
  {
    heading: "Reports",
    links: [
      { href: "/reports/sales-register", label: "Sales Register" },
      { href: "/reports/purchase-register", label: "Purchase Register" },
      { href: "/reports/trial-balance", label: "Trial Balance" },
      { href: "/reports/profit-loss", label: "Profit & Loss" },
      { href: "/reports/balance-sheet", label: "Balance Sheet" },
      { href: "/reports/gst-summary", label: "GST Summary" },
      { href: "/reports/stock", label: "Stock Report" },
    ],
  },
  {
    heading: "Setup",
    links: [{ href: "/settings", label: "Company Settings" }],
  },
];

export default function Nav() {
  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark">₹</span>
        <span className="brand-name">Busy&nbsp;MVP</span>
      </div>
      {SECTIONS.map((section) => (
        <div key={section.heading} className="nav-group">
          <div className="nav-heading">{section.heading}</div>
          {section.links.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link">
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
