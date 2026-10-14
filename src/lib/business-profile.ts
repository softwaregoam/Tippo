import type { InvoiceAppearance } from "./invoice-template.ts";
export interface InvoiceSettings { invoiceStoreName: string; invoicePrefix: string; appearance?: InvoiceAppearance }
export interface BusinessProfile extends InvoiceSettings { name: string; phone: string; address: string }
export const DEMO_PROFILE_KEY = "tippo.business.demo.v1";
export function validateBusinessProfile(profile: Pick<BusinessProfile, "name" | "phone" | "address"> & Partial<InvoiceSettings>): BusinessProfile {
  if (typeof profile.name !== "string" || !profile.name.trim() || profile.name.length > 120) throw new Error("Isi nama usaha, maksimal 120 karakter.");
  if (typeof profile.phone !== "string" || profile.phone.length > 30) throw new Error("Nomor WhatsApp maksimal 30 karakter.");
  if (typeof profile.address !== "string" || profile.address.length > 1000) throw new Error("Alamat usaha maksimal 1.000 karakter.");
  if (profile.invoiceStoreName !== undefined && (typeof profile.invoiceStoreName !== "string" || profile.invoiceStoreName.length > 120)) throw new Error("Nama toko pada invoice maksimal 120 karakter.");
  if (profile.invoicePrefix !== undefined && (typeof profile.invoicePrefix !== "string" || !/^[A-Za-z0-9][A-Za-z0-9/_-]{0,19}$/.test(profile.invoicePrefix.trim()))) throw new Error("Awalan nomor invoice berisi 1–20 huruf, angka, garis miring, tanda hubung, atau garis bawah.");
  return { name: profile.name.trim(), phone: profile.phone.trim(), address: profile.address.trim(), invoiceStoreName: (profile.invoiceStoreName ?? "").trim(), invoicePrefix: (profile.invoicePrefix ?? "INV").trim().toUpperCase() };
}
export function readBusinessProfile(value: unknown, fallback = "Usaha kamu"): BusinessProfile {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    invoiceStoreName: typeof data.invoiceStoreName === "string" && data.invoiceStoreName.length <= 120 ? data.invoiceStoreName.trim() : "",
    invoicePrefix: typeof data.invoicePrefix === "string" && /^[A-Za-z0-9][A-Za-z0-9/_-]{0,19}$/.test(data.invoicePrefix.trim()) ? data.invoicePrefix.trim().toUpperCase() : "INV",
    name: typeof data.name === "string" && data.name.trim() && data.name.length <= 120 ? data.name : fallback,
    phone: typeof data.phone === "string" && data.phone.length <= 30 ? data.phone : "",
    address: typeof data.address === "string" && data.address.length <= 1000 ? data.address : "",
  };
}
