import { validateBusinessProfile, type InvoiceSettings } from "./business-profile.ts";
export type InvoiceAppearance = { logoUrl: string; color: string; layout: "classic" | "minimal"; footer: string };
export type InvoiceTemplate = InvoiceSettings & { appearance: InvoiceAppearance };
export const DEFAULT_INVOICE_APPEARANCE: InvoiceAppearance = {logoUrl:"",color:"#245C4E",layout:"classic",footer:"Terima kasih sudah memesan!"};
export function validLogoUrl(value: unknown): value is string {
  if (typeof value!=="string") return false;
  if (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value.length<=1400000;
  if (value.length>2048) return false;
  if (!value) return true;
  try {const url=new URL(value);return url.protocol==="https:" && !url.username && !url.password;} catch {return false;}
}
export function readInvoiceAppearance(value: unknown): InvoiceAppearance {
  const data=value && typeof value==="object" ? value as Record<string,unknown> : {};
  return {logoUrl:validLogoUrl(data.logoUrl)?data.logoUrl:"",color:typeof data.color==="string" && /^#[0-9a-f]{6}$/i.test(data.color)?data.color.toUpperCase():DEFAULT_INVOICE_APPEARANCE.color,layout:data.layout==="minimal"?"minimal":"classic",footer:typeof data.footer==="string" && data.footer.length<=160?data.footer:DEFAULT_INVOICE_APPEARANCE.footer};
}
export function validateInvoiceTemplate(value: InvoiceTemplate): InvoiceTemplate {
  const profile=validateBusinessProfile({name:"Invoice",phone:"",address:"",invoiceStoreName:value.invoiceStoreName,invoicePrefix:value.invoicePrefix});
  if (!validLogoUrl(value.appearance.logoUrl)) throw new Error("Gunakan tautan logo HTTPS yang valid.");
  if (!/^#[0-9a-f]{6}$/i.test(value.appearance.color)) throw new Error("Pilih warna invoice yang valid.");
  if (!["classic","minimal"].includes(value.appearance.layout)) throw new Error("Pilih tampilan invoice.");
  if (typeof value.appearance.footer!=="string" || value.appearance.footer.length>160) throw new Error("Catatan penutup maksimal 160 karakter.");
  return {invoiceStoreName:profile.invoiceStoreName,invoicePrefix:profile.invoicePrefix,appearance:readInvoiceAppearance(value.appearance)};
}
