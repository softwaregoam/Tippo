/** Drafts are local documents, never proof of payment or subscription entitlement. */
export interface ProInvoice {
  id: string;
  ownerId: string;
  createdAt: string;
  businessName: string;
  email: string;
  amount: 25000;
  currency: "IDR";
  months: 1;
  status: "draft";
}

function invoiceCode(now: Date, nonce: string): string {
  const parts = new Intl.DateTimeFormat("en", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" }).formatToParts(now);
  const date = ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("");
  return `INV-PRO-${date}-${nonce.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

export function formatProInvoiceDate(createdAt: string): string {
  return `${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(createdAt))} WIB`;
}

export function createProInvoice(account: { id: string; name: string; email: string }, now = new Date(), id = crypto.randomUUID()): ProInvoice {
  return { id: invoiceCode(now, id), ownerId: account.id, createdAt: now.toISOString(), businessName: account.name, email: account.email, amount: 25000, currency: "IDR", months: 1, status: "draft" };
}

export function parseProInvoice(value: unknown, ownerId: string): ProInvoice | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ProInvoice>;
  if (!(row.ownerId === ownerId && typeof row.id === "string" && /^INV-PRO-(?:\d{8}-[A-F0-9]{16}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(row.id) && typeof row.createdAt === "string" && Number.isFinite(Date.parse(row.createdAt)) && typeof row.businessName === "string" && typeof row.email === "string" && row.amount === 25000 && row.currency === "IDR" && row.months === 1 && row.status === "draft")) return null;
  const invoice = row as ProInvoice;
  return /^INV-PRO-\d{8}-[A-F0-9]{16}$/i.test(invoice.id) ? invoice : { ...invoice, id: invoiceCode(new Date(invoice.createdAt), invoice.id.slice(8)) };
}

export function proInvoiceText(invoice: ProInvoice): string {
  const date = formatProInvoiceDate(invoice.createdAt);
  return ["TIPPO · DRAF INVOICE LANGGANAN", invoice.id, `Tanggal dibuat: ${date}`, `Nama usaha: ${invoice.businessName}`, `Email: ${invoice.email}`, "", "Tippo Pro · 1 bulan", "Subtotal: Rp25.000", "Total: Rp25.000", "Status: Draf · pembayaran belum tersedia", "", "Belum ada pembayaran yang diterima. Ini bukan bukti pembayaran.", "QRIS belum tersedia. Pro aktif setelah pembayaran terverifikasi.", "Masa aktif ditambahkan dari tanggal berakhir jika Pro masih aktif, atau dari tanggal aktivasi jika belum aktif."].join("\n");
}
