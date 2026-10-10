import type { AppData } from "./types.ts";
import type { OrderUsage, Subscription } from "./subscription.ts";
import { isAppData } from "./validation.ts";
export interface CloudRecord { data: AppData; version: number; subscription: Subscription; usage: OrderUsage[] }
export function parseCloudRecord(value: unknown): CloudRecord {
  if (!value || typeof value !== "object") throw new Error("Data workspace belum dapat dibaca.");
  const row = value as Record<string, unknown>;
  if (!isAppData(row.data) || !Number.isSafeInteger(row.version) || (row.version as number) < 0) throw new Error("Format workspace tidak valid. Data belum diubah.");
  const plan = row.subscription as Record<string, unknown> | undefined;
  if (!plan || (plan.tier !== "free" && plan.tier !== "pro") || !(plan.expiresAt === null || (typeof plan.expiresAt === "string" && Number.isFinite(Date.parse(plan.expiresAt))))) throw new Error("Status paket belum dapat dibaca.");
  if (!Array.isArray(row.usage) || !row.usage.every((entry) => entry && typeof entry.orderId === "string" && (entry.type === "jastip" || entry.type === "po") && /^\d{4}-(0[1-9]|1[0-2])$/.test(entry.month))) throw new Error("Kuota workspace belum dapat dibaca.");
  return { data: row.data, version: row.version as number, subscription: { tier: plan.tier, expiresAt: plan.expiresAt as string | null, mode: "live" }, usage: row.usage };
}
export function cloudErrorMessage(error: { code?: string; message?: string }): string {
  const message = error.message ?? "";
  if (/TIPPO_CONFLICT/.test(message)) return "Data berubah di perangkat lain. Muat data terbaru sebelum menyimpan kembali.";
  if (/TIPPO_ORDER_LIMIT/.test(message)) return "Kuota 5 pesanan bulan ini sudah terpakai untuk jenis pesanan ini.";
  if (/TIPPO_PRODUCT_LIMIT/.test(message)) return "Paket Gratis maksimal 5 produk Open PO, termasuk produk arsip.";
  if (/TIPPO_INVALID/.test(message)) return "Data belum valid. Periksa barang, pembayaran, dan batch pesanan.";
  if (error.code === "PGRST202" || error.code === "42P01" || /schema cache/.test(message)) return "Workspace belum siap. Pengelola perlu mengaktifkan database Tippo terlebih dahulu.";
  return "Data belum tersimpan. Periksa koneksi internet, lalu coba lagi. Isianmu tetap tersedia.";
}
