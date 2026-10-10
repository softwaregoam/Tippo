import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}

export async function isGoogleAuthEnabled(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: "no-store" });
  if (!response.ok) throw new Error("Pengaturan login belum dapat diperiksa.");
  const settings = await response.json();
  return settings.external?.google === true;
}

export function authErrorMessage(error: { message?: string; code?: string } | null): string {
  if (!error) return "Terjadi kendala. Coba lagi sebentar.";
  if (error.code === "invalid_credentials" || /Invalid login credentials/i.test(error.message ?? "")) return "Email atau kata sandi belum cocok. Periksa kembali, ya.";
  if (error.code === "email_not_confirmed") return "Konfirmasi emailmu terlebih dahulu melalui tautan dari Tippo.";
  if (/rate|too many/i.test(error.message ?? "")) return "Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.";
  if (/password/i.test(error.message ?? "")) return "Gunakan kata sandi minimal 8 karakter. Hindari kata sandi yang mudah ditebak.";
  return "Belum berhasil terhubung. Periksa koneksi internet dan coba lagi.";
}
