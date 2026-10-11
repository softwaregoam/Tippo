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

export function createProInvoice(account: { id: string; name: string; email: string }, now = new Date(), id = crypto.randomUUID()): ProInvoice {
  return { id: `INV-PRO-${id}`, ownerId: account.id, createdAt: now.toISOString(), businessName: account.name, email: account.email, amount: 25000, currency: "IDR", months: 1, status: "draft" };
}

export function parseProInvoice(value: unknown, ownerId: string): ProInvoice | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ProInvoice>;
  return row.ownerId === ownerId && typeof row.id === "string" && /^INV-PRO-[a-zA-Z0-9-]+$/.test(row.id) && typeof row.createdAt === "string" && Number.isFinite(Date.parse(row.createdAt)) && typeof row.businessName === "string" && typeof row.email === "string" && row.amount === 25000 && row.currency === "IDR" && row.months === 1 && row.status === "draft" ? row as ProInvoice : null;
}

export function proInvoiceText(invoice: ProInvoice): string {
  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(invoice.createdAt));
  return ["TIPPO · DRAF INVOICE LANGGANAN", invoice.id, `Tanggal: ${date} WIB`, `Nama usaha: ${invoice.businessName}`, `Email: ${invoice.email}`, "", "Tippo Pro · 1 bulan", "Subtotal: Rp25.000", "Total: Rp25.000", "Status: Draf · pembayaran belum tersedia", "", "Belum ada pembayaran yang diterima. Ini bukan bukti pembayaran.", "QRIS belum tersedia. Pro aktif setelah pembayaran terverifikasi.", "Masa aktif ditambahkan dari tanggal berakhir jika Pro masih aktif, atau dari tanggal aktivasi jika belum aktif."].join("\n");
}
