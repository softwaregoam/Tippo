export interface SandboxInvoice {
  id: string; number: string; amount: number; currency: "IDR";
  status: "creating" | "pending" | "paid" | "expired" | "error" | "cancelled";
  checkoutUrl: string | null; createdAt: string; expiresAt: string; paidAt: string | null;
  recoveryRequired?:boolean;
  customerName?:string|null; customerEmail?:string|null;
}
export interface SandboxBilling { environment: "sandbox" | "production-test"; invoice: SandboxInvoice | null; proUntil: string | null; invoices?:SandboxInvoice[]; }
export function parseSandboxBilling(value: unknown): SandboxBilling { return parseBilling(value,"sandbox"); }
export function parseProductionTestBilling(value:unknown):SandboxBilling { return parseBilling(value,"production-test"); }
function parseBilling(value: unknown, mode:"sandbox"|"production-test"): SandboxBilling {
  if (!value || typeof value !== "object") throw new Error("Invalid billing response");
  const record = value as SandboxBilling;
  if(record.invoices!==undefined){
    if(mode!=="production-test" || !Array.isArray(record.invoices) || record.invoices.length>20)throw new Error("Invalid invoice history");
    for(const invoice of record.invoices)parseBilling({environment:mode,proUntil:null,invoice},mode);
  }
  if (record.environment !== mode || (mode==="production-test" && record.proUntil!==null) || (record.proUntil !== null && !Number.isFinite(Date.parse(record.proUntil)))) throw new Error("Invalid sandbox environment");
  if (record.invoice !== null) {
    const i=record.invoice;
    if(!i || typeof i!=="object")throw new Error("Invalid invoice");
    if(i.recoveryRequired!==undefined && typeof i.recoveryRequired!=="boolean")throw new Error("Invalid recovery state");
    for(const field of [i.customerName,i.customerEmail])if(field!==undefined && field!==null && (typeof field!=="string" || field.length>320))throw new Error("Invalid customer");
    if (!i || typeof i.id!=="string" || typeof i.number!=="string" || !(mode==="sandbox"?/^TSBX-[A-F0-9]{32}$/:/^(TPT-[A-F0-9]{32}|TPT[A-F0-9]{24})$/).test(i.number) || (mode==="sandbox"?i.amount!==25000:![10,1000,10000].includes(i.amount)) || i.currency!=="IDR" || !["creating","pending","paid","expired","error",...(mode==="production-test"?["cancelled"]:[])].includes(i.status) || !Number.isFinite(Date.parse(i.createdAt)) || !Number.isFinite(Date.parse(i.expiresAt)) || (i.paidAt!==null && !Number.isFinite(Date.parse(i.paidAt)))) throw new Error("Invalid sandbox invoice");
    if (i.checkoutUrl!==null) {
      const url=new URL(i.checkoutUrl);
      const hosts=mode==="sandbox"?["sandbox.doku.com"]:["jokul.doku.com","checkout.doku.com"];
      if (url.protocol!=="https:" || !hosts.includes(url.hostname) || url.username || url.password || (url.port && url.port!=="443")) throw new Error("Invalid checkout URL");
    }
  }
  return record;
}
