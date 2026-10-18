import type { Order, PurchaseFx } from "./types.ts";

export const FX_CURRENCIES = ["JPY", "KRW", "SGD", "USD", "EUR", "CNY", "MYR", "THB", "HKD", "AUD", "GBP"] as const;
export type FxDraft = { currency: string; amount: string; rate: string; status: "estimate" | "final"; source: "manual" | "frankfurter"; rateDate?: string };
const decimal = /^\d{1,12}(?:\.\d{1,6})?$/;
const scale = BigInt(1000000);
export function decimalUnits(value: string): bigint | null {
  if (!decimal.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * scale + BigInt(fraction.padEnd(6, "0"));
}
export function canonicalDecimal(value: string): string | null {
  const text = value.trim().replace(",", ".");
  if (decimalUnits(text) === null) return null;
  const [whole, fraction = ""] = text.split(".");
  const tail = fraction.replace(/0+$/, "");
  return `${BigInt(whole)}${tail ? `.${tail}` : ""}`;
}
/** Indonesian input: dots group thousands; a comma separates decimal digits. */
export function inputDecimal(value: string): string | null {
  const text = value.trim();
  if (!/^(?:[0-9]{1,12}|[0-9]{1,3}(?:\.[0-9]{3}){1,3})(?:,[0-9]{1,6})?$/.test(text)) return null;
  return canonicalDecimal(text.replaceAll(".", ""));
}
export function convertedCost(amount: string | null, rate: string | null): number | null {
  if (amount === null || rate === null) return null;
  const a = decimalUnits(amount), r = decimalUnits(rate);
  if (a === null || r === null || r <= BigInt(0)) return null;
  const divisor = scale * scale, rounded = (a * r + divisor / BigInt(2)) / divisor;
  return rounded <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rounded) : null;
}
export function fxFromDraft(draft: FxDraft): PurchaseFx {
  return { currency: draft.currency, amount: draft.amount.trim() ? inputDecimal(draft.amount) : null,
    rate: draft.rate.trim() ? inputDecimal(draft.rate) : null, status: draft.status,
    source: draft.source, ...(draft.source === "frankfurter" && draft.rateDate ? { rateDate: draft.rateDate } : {}) };
}
export function draftFromFx(fx?: PurchaseFx): FxDraft | undefined {
  return fx ? { currency: fx.currency, amount: fx.amount?.replace(".", ",") ?? "", rate: fx.rate?.replace(".", ",") ?? "", status: fx.status, source: fx.source, rateDate: fx.rateDate } : undefined;
}
export function fxDraftError(draft?: FxDraft): string | null {
  if (!draft) return null;
  const fx = fxFromDraft(draft);
  if (!(FX_CURRENCIES as readonly string[]).includes(draft.currency)) return "Pilih mata uang yang tersedia.";
  if (draft.amount.trim() && fx.amount === null || draft.rate.trim() && fx.rate === null) return "Gunakan format angka Indonesia, misalnya 1.000,50 (maksimal 6 angka desimal).";
  if (fx.rate !== null && decimalUnits(fx.rate)! <= BigInt(0)) return "Kurs harus lebih besar dari nol.";
  const cost = convertedCost(fx.amount, fx.rate);
  if (fx.amount !== null && fx.rate !== null && cost === null) return "Hasil konversi terlalu besar.";
  if (fx.status === "final" && cost === null) return "Isi harga beli dan kurs sebelum memilih Final.";
  return null;
}
export function validPurchaseFx(value: unknown, unitCost: unknown): value is PurchaseFx {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fx = value as PurchaseFx;
  if (!(FX_CURRENCIES as readonly unknown[]).includes(fx.currency) || !["estimate", "final"].includes(fx.status) || !["manual", "frankfurter"].includes(fx.source)) return false;
  if (!(fx.amount === null || typeof fx.amount === "string" && decimalUnits(fx.amount) !== null) || !(fx.rate === null || typeof fx.rate === "string" && decimalUnits(fx.rate) !== null && decimalUnits(fx.rate)! > BigInt(0))) return false;
  if (fx.rateDate !== undefined && (typeof fx.rateDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fx.rateDate) || !Number.isFinite(Date.parse(fx.rateDate)) || new Date(fx.rateDate).toISOString().slice(0,10) !== fx.rateDate)) return false;
  if (fx.source === "frankfurter" && (fx.rate === null || !fx.rateDate)) return false;
  const cost = convertedCost(fx.amount, fx.rate);
  return !(fx.amount !== null && fx.rate !== null && cost === null) && (fx.status !== "final" || cost !== null) && unitCost === cost;
}
export const hasEstimatedCost = (order: Pick<Order, "items">) => order.items.some(item => item.purchaseFx?.status === "estimate");
/** Markup from purchase cost, rounded upward to avoid reducing the requested markup. */
export function suggestedPrice(cost: number | null, percent: string): number | null {
  const canonical = inputDecimal(percent);
  if (cost === null || !Number.isSafeInteger(cost) || cost < 0 || canonical === null) return null;
  const rate = decimalUnits(canonical)!, divisor = BigInt(100) * scale;
  const result = (BigInt(cost) * (divisor + rate) + divisor - BigInt(1)) / divisor;
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null;
}
export function readFrankfurterRate(value: unknown, currency: string, now = new Date()): { rate: string; date: string } {
  const data = value as { base?: unknown; amount?: unknown; date?: unknown; rates?: { IDR?: unknown } } | null;
  const rate = data?.rates?.IDR;
  if (!data || data.base !== currency || data.amount !== 1 || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error("INVALID_RATE");
  const parsed = new Date(data.date), today = now.toISOString().slice(0,10);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== data.date || data.date > today || now.getTime() - parsed.getTime() > 10 * 86400000) throw new Error("STALE_RATE");
  const canonical = canonicalDecimal(rate.toFixed(6));
  if (!canonical || decimalUnits(canonical)! <= BigInt(0)) throw new Error("INVALID_RATE");
  return { rate: canonical, date: data.date };
}

export type BatchPurchaseFx = NonNullable<import("./types.ts").Batch["purchaseFx"]>;
export function validBatchPurchaseFx(value: unknown): value is BatchPurchaseFx {
  return !!value && typeof value === "object" && !Array.isArray(value) && validPurchaseFx({ ...value, amount: null, status: "estimate" }, null);
}
export async function fetchPurchaseRate(currency: string, signal: AbortSignal): Promise<BatchPurchaseFx> {
  const response = await fetch(`https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(currency)}&to=IDR`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
  });
  if (!response.ok) throw new Error("RATE_UNAVAILABLE");
  const result = readFrankfurterRate(await response.json(), currency);
  return { currency, rate: result.rate, rateDate: result.date, source: "frankfurter" };
}
export function batchFxDraft(fx?: BatchPurchaseFx): FxDraft | undefined {
  return fx ? draftFromFx({ ...fx, amount: null, status: "estimate" }) : undefined;
}
