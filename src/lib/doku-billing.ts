export interface SandboxInvoice {
  id: string; number: string; amount: number; currency: "IDR";
  status: "creating" | "pending" | "paid" | "expired" | "error";
  checkoutUrl: string | null; createdAt: string; expiresAt: string; paidAt: string | null;
}
export interface SandboxBilling { environment: "sandbox" | "production-test"; invoice: SandboxInvoice | null; proUntil: string | null; }
export function parseSandboxBilling(value: unknown): SandboxBilling { return parseBilling(value,"sandbox"); }
export function parseProductionTestBilling(value:unknown):SandboxBilling { return parseBilling(value,"production-test"); }
function parseBilling(value: unknown, mode:"sandbox"|"production-test"): SandboxBilling {
  if (!value || typeof value !== "object") throw new Error("Invalid billing response");
  const record = value as SandboxBilling;
  if (record.environment !== mode || (mode==="production-test" && record.proUntil!==null) || (record.proUntil !== null && !Number.isFinite(Date.parse(record.proUntil)))) throw new Error("Invalid sandbox environment");
  if (record.invoice !== null) {
    const i=record.invoice;
    if (!i || typeof i.id!=="string" || typeof i.number!=="string" || !(mode==="sandbox"?/^TSBX-[A-F0-9]{32}$/:/^TPT-[A-F0-9]{32}$/).test(i.number) || (mode==="sandbox"?i.amount!==25000:![10,1000].includes(i.amount)) || i.currency!=="IDR" || !["creating","pending","paid","expired","error"].includes(i.status) || !Number.isFinite(Date.parse(i.createdAt)) || !Number.isFinite(Date.parse(i.expiresAt)) || (i.paidAt!==null && !Number.isFinite(Date.parse(i.paidAt)))) throw new Error("Invalid sandbox invoice");
    if (i.checkoutUrl!==null) {
      const url=new URL(i.checkoutUrl);
      if (url.protocol!=="https:" || url.hostname!==(mode==="sandbox"?"sandbox.doku.com":"jokul.doku.com") || url.username || url.password || (url.port && url.port!=="443")) throw new Error("Invalid checkout URL");
    }
  }
  return record;
}
