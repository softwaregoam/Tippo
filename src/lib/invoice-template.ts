import { validateBusinessProfile, type InvoiceSettings } from "./business-profile.ts";
export type InvoiceAppearance = { logoUrl: string; color: string; layout: "classic" | "minimal"; footer: string; bankName?: string; bankAccount?: string; bankHolder?: string; modeColors?: {jastip:string;po:string} };
export type InvoiceBankSettings = Pick<InvoiceAppearance,"bankName"|"bankAccount"|"bankHolder">;
export type InvoiceTemplate = InvoiceSettings & { appearance: InvoiceAppearance };
export const DEFAULT_INVOICE_APPEARANCE: InvoiceAppearance = {logoUrl:"",color:"#245C4E",layout:"classic",footer:"Terima kasih sudah memesan!",bankName:"",bankAccount:"",bankHolder:"",modeColors:{jastip:"#245C4E",po:"#94501F"}};
export function validLogoUrl(value: unknown): value is string {
  if (typeof value!=="string") return false;
  if (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value.length<=1400000;
  if (value.length>2048) return false;
  if (!value) return true;
  try {const url=new URL(value);return url.protocol==="https:" && !url.username && !url.password;} catch {return false;}
}
function singleLine(value: unknown, limit: number): string {
  return typeof value==="string" && value.length<=limit ? value.replace(/\s+/g," ").trim() : "";
}
function accountNumber(value: unknown): string {
  return typeof value==="string" && value.length<=40 && /^[0-9 -]*$/.test(value.trim()) ? value.trim().replace(/[ -]/g,"") : "";
}
export function invoiceBankDetails(appearance: InvoiceAppearance): {name:string;account:string;holder:string}|null {
  const name=singleLine(appearance.bankName,80),account=accountNumber(appearance.bankAccount),holder=singleLine(appearance.bankHolder,120);
  return name&&account&&holder ? {name,account,holder} : null;
}
export function readInvoiceAppearance(value: unknown): InvoiceAppearance {
  const data=value && typeof value==="object" ? value as Record<string,unknown> : {};
  const colors=data.modeColors&&typeof data.modeColors==="object"?data.modeColors as Record<string,unknown>:{};
  const validColor=(value:unknown)=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value);
  const modeColors={jastip:validColor(colors.jastip)?String(colors.jastip).toUpperCase():validColor(data.color)?String(data.color).toUpperCase():"#245C4E",po:validColor(colors.po)?String(colors.po).toUpperCase():"#94501F"};
  return {modeColors,bankName:singleLine(data.bankName,80),bankAccount:accountNumber(data.bankAccount),bankHolder:singleLine(data.bankHolder,120),logoUrl:validLogoUrl(data.logoUrl)?data.logoUrl:"",color:typeof data.color==="string" && /^#[0-9a-f]{6}$/i.test(data.color)?data.color.toUpperCase():DEFAULT_INVOICE_APPEARANCE.color,layout:data.layout==="minimal"?"minimal":"classic",footer:typeof data.footer==="string" && data.footer.length<=160?data.footer:DEFAULT_INVOICE_APPEARANCE.footer};
}
export function invoiceAppearanceForMode(value:unknown,mode:"jastip"|"po"):InvoiceAppearance {
  const appearance=readInvoiceAppearance(value);
  return {...appearance,color:appearance.modeColors![mode]};
}
export function validateInvoiceTemplate(value: InvoiceTemplate): InvoiceTemplate {
  const profile=validateBusinessProfile({name:"Invoice",phone:"",address:"",invoiceStoreName:value.invoiceStoreName,invoicePrefix:value.invoicePrefix});
  if (!validLogoUrl(value.appearance.logoUrl)) throw new Error("Gunakan tautan logo HTTPS yang valid.");
  if (!/^#[0-9a-f]{6}$/i.test(value.appearance.color)) throw new Error("Pilih warna invoice yang valid.");
  if (!["classic","minimal"].includes(value.appearance.layout)) throw new Error("Pilih tampilan invoice.");
  if (typeof value.appearance.footer!=="string" || value.appearance.footer.length>160) throw new Error("Catatan penutup maksimal 160 karakter.");
  for(const [bankValue,limit,label] of [[value.appearance.bankName,80,"Nama bank"],[value.appearance.bankHolder,120,"Atas nama"]] as const){
    if(bankValue!==undefined && (typeof bankValue!=="string"||bankValue.length>limit))throw new Error(`${label} maksimal ${limit} karakter.`);
  }
  const account=value.appearance.bankAccount;
  if(account!==undefined && (typeof account!=="string"||account.length>40||!/^[0-9 -]*$/.test(account.trim())))throw new Error("Nomor rekening hanya berisi angka, maksimal 40 karakter.");
  if(value.appearance.modeColors&&!Object.values(value.appearance.modeColors).every(color=>typeof color==="string"&&/^#[0-9a-f]{6}$/i.test(color)))throw new Error("Pilih warna invoice yang valid.");
  const appearance=readInvoiceAppearance(value.appearance);
  if((appearance.bankName||appearance.bankAccount||appearance.bankHolder)&&!invoiceBankDetails(appearance))throw new Error("Lengkapi nama bank, nomor rekening, dan atas nama.");
  return {invoiceStoreName:profile.invoiceStoreName,invoicePrefix:profile.invoicePrefix,appearance};
}
