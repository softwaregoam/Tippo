export interface SandboxInvoice {
  id: string; number: string; amount: number; currency: "IDR";
  status: "creating" | "pending" | "paid" | "expired" | "error";
  checkoutUrl: string | null; createdAt: string; expiresAt: string; paidAt: string | null;
}
export interface SandboxBilling { environment: "sandbox"; invoice: SandboxInvoice | null; proUntil: string | null; }
export function parseSandboxBilling(value: unknown): SandboxBilling {
  if (!value || typeof value !== "object") throw new Error("Invalid billing response");
  const record = value as SandboxBilling;
  if (record.environment !== "sandbox" || (record.proUntil !== null && !Number.isFinite(Date.parse(record.proUntil)))) throw new Error("Invalid sandbox environment");
  if (record.invoice !== null) {
    const i=record.invoice;
    if (!i || typeof i.id!=="string" || typeof i.number!=="string" || !/^TSBX-[A-F0-9]{32}$/.test(i.number) || i.amount!==25000 || i.currency!=="IDR" || !["creating","pending","paid","expired","error"].includes(i.status) || !Number.isFinite(Date.parse(i.createdAt)) || !Number.isFinite(Date.parse(i.expiresAt)) || (i.paidAt!==null && !Number.isFinite(Date.parse(i.paidAt)))) throw new Error("Invalid sandbox invoice");
    if (i.checkoutUrl!==null) {
      const url=new URL(i.checkoutUrl);
      if (url.protocol!=="https:" || url.hostname!=="sandbox.doku.com" || url.username || url.password || (url.port && url.port!=="443")) throw new Error("Invalid checkout URL");
    }
  }
  return record;
}
