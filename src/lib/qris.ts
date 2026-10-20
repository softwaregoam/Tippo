import { outstanding } from "./finance.ts";
import type { Order } from "./types.ts";

export const QRIS_MAX_BYTES = 1024 * 1024;
const types = ["image/png", "image/jpeg", "image/webp"];
export function validQrisUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
export function showQris(order: Order, url: unknown): boolean {
  return validQrisUrl(url) && !!url && order.status !== "cancelled" && outstanding(order) > 0;
}
export function qrisExtension(type: string): string {
  if (!types.includes(type)) throw new Error("Pilih gambar QRIS PNG, JPG, atau WebP.");
  return type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
}
export async function validateQrisFile(file: File): Promise<void> {
  qrisExtension(file.type);
  if (!file.size || file.size > QRIS_MAX_BYTES) throw new Error("Ukuran QRIS maksimal 1 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
  if (!(file.type === "image/png" && png || file.type === "image/jpeg" && jpeg || file.type === "image/webp" && webp)) throw new Error("File bukan gambar QRIS yang valid.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 25000000) throw new Error("Dimensi gambar terlalu besar.");
  } catch { throw new Error("Gambar QRIS tidak dapat dibaca atau dimensinya terlalu besar."); }
  finally { URL.revokeObjectURL(url); }
}
/** Preserve the uploaded pixels; QR codes are never cropped, resized, or recompressed. */
export async function downloadQris(url: string, reference: string): Promise<void> {
  if (!url || !validQrisUrl(url)) throw new Error("QRIS belum tersedia.");
  const response = await fetch(url, {credentials:"omit",signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error("QRIS belum dapat diunduh. Coba lagi.");
  const blob = await response.blob(), extension = qrisExtension(blob.type);
  if (!blob.size || blob.size > QRIS_MAX_BYTES) throw new Error("Gambar QRIS tidak valid.");
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a"); link.href = objectUrl;
    link.download = `QRIS-${reference.replace(/[^A-Za-z0-9_-]/g,"-")}.${extension}`;
    document.body.append(link); link.click(); link.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
}
