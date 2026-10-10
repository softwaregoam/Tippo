export interface BusinessProfile { name: string; phone: string; address: string }
export const DEMO_PROFILE_KEY = "tippo.business.demo.v1";
export function validateBusinessProfile(profile: BusinessProfile): BusinessProfile {
  if (typeof profile.name !== "string" || !profile.name.trim() || profile.name.length > 120) throw new Error("Isi nama usaha, maksimal 120 karakter.");
  if (typeof profile.phone !== "string" || profile.phone.length > 30) throw new Error("Nomor WhatsApp maksimal 30 karakter.");
  if (typeof profile.address !== "string" || profile.address.length > 1000) throw new Error("Alamat usaha maksimal 1.000 karakter.");
  return { name: profile.name.trim(), phone: profile.phone.trim(), address: profile.address.trim() };
}
export function readBusinessProfile(value: unknown, fallback = "Usaha kamu"): BusinessProfile {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    name: typeof data.name === "string" && data.name.trim() && data.name.length <= 120 ? data.name : fallback,
    phone: typeof data.phone === "string" && data.phone.length <= 30 ? data.phone : "",
    address: typeof data.address === "string" && data.address.length <= 1000 ? data.address : "",
  };
}
