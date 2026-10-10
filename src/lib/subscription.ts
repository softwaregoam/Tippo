"use client";

import { useSyncExternalStore } from "react";
import type { AppData, Batch, BatchType, Order } from "./types.ts";

export const FREE_ORDER_LIMIT = 5;
export const FREE_PRODUCT_LIMIT = 5;
export const PRO_MONTHLY_PRICE = 25_000;
export const SUBSCRIPTION_STORAGE_KEY = "tippo.subscription.demo.v1";
export const USAGE_STORAGE_KEY = "tippo.usage.demo.v1";

/** Quota metadata deliberately contains no customer, product, or payment information. */
export interface OrderUsage {
  orderId: string;
  type: BatchType;
  month: string;
}

/** Local entitlement prototype. This is not a payment or a verified subscription. */
export interface Subscription {
  tier: "free" | "pro";
  expiresAt: string | null;
  mode: "demo" | "live";
}

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  remaining: number;
  message: string;
}

export const FREE_SUBSCRIPTION: Subscription = { tier: "free", expiresAt: null, mode: "demo" };
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Billing and monthly limits use Asia/Jakarta, regardless of the device timezone. */
export function jakartaMonth(now = new Date()): string {
  return new Date(now.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 7);
}

/** Adds one calendar month in Jakarta, clamping e.g. 31 January to 28 February. */
export function proExpiry(now = new Date()): string {
  const local = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const targetMonth = local.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
  const target = Date.UTC(
    local.getUTCFullYear(), targetMonth, Math.min(local.getUTCDate(), lastDay),
    local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds(),
  );
  return new Date(target - JAKARTA_OFFSET_MS).toISOString();
}

export function effectivePlan(subscription: Subscription, now = new Date()): "free" | "pro" {
  const expires = subscription.expiresAt ? Date.parse(subscription.expiresAt) : NaN;
  return subscription.tier === "pro" && Number.isFinite(expires) && now.getTime() < expires ? "pro" : "free";
}

/** First recorded creation metadata wins, so a restore cannot move an order's quota. */
export function mergeUsageLedger(existing: readonly OrderUsage[], orders: readonly Order[], batches: readonly Batch[]): OrderUsage[] {
  const entries = new Map<string, OrderUsage>();
  for (const entry of existing) if (!entries.has(entry.orderId)) entries.set(entry.orderId, entry);
  const batchTypes = new Map(batches.map((batch) => [batch.id, batch.type]));
  for (const order of orders) {
    if (entries.has(order.id)) continue;
    const created = new Date(order.createdAt);
    const type = batchTypes.get(order.batchId);
    if (type && Number.isFinite(created.getTime())) entries.set(order.id, { orderId: order.id, type, month: jakartaMonth(created) });
  }
  return [...entries.values()];
}

/** Pure quota count for validation and tests; recorded IDs survive missing workspace rows. */
export function orderUsageForMonth(data: AppData, now = new Date(), type?: BatchType, ledger: readonly OrderUsage[] = []): number {
  const month = jakartaMonth(now);
  return mergeUsageLedger(ledger, data.orders, data.batches).filter((entry) => entry.month === month && (!type || entry.type === type)).length;
}

/** Cancelled and deleted orders still use quota. The browser ledger survives app resets. */
export function monthlyOrderUsage(data: AppData, now = new Date(), type?: BatchType): number {
  return orderUsageForMonth(data, now, type, getUsageLedger());
}

/** Count customer orders, not item rows. Each mode has its own monthly free quota. */
export function canCreateOrders(data: AppData, subscription: Subscription, newCount = 1, now = new Date(), type?: BatchType): QuotaCheck {
  const used = monthlyOrderUsage(data, now, type);
  if (!Number.isSafeInteger(newCount) || newCount < 0) {
    return { allowed: false, used, remaining: 0, message: "Jumlah pesanan baru tidak valid." };
  }
  if (effectivePlan(subscription, now) === "pro") return { allowed: true, used, remaining: Infinity, message: "" };
  if (!type) return { allowed: false, used, remaining: 0, message: "Pilih Jastip atau Open PO untuk memeriksa kuota pesanan." };
  const remaining = Math.max(0, FREE_ORDER_LIMIT - used);
  return {
    allowed: newCount <= remaining,
    used,
    remaining,
    message: newCount <= remaining ? "" : `Kuota Gratis ${type === "jastip" ? "Jastip" : "Open PO"} tersisa ${remaining} dari ${FREE_ORDER_LIMIT} pesanan bulan ini. Upgrade ke Pro untuk menambah pesanan.`,
  };
}

/** Archiving preserves the master record and does not free a product slot. */
export function canCreateProduct(data: AppData, subscription: Subscription, now = new Date()): QuotaCheck {
  const used = data.products.length;
  if (effectivePlan(subscription, now) === "pro") return { allowed: true, used, remaining: Infinity, message: "" };
  const remaining = Math.max(0, FREE_PRODUCT_LIMIT - used);
  return {
    allowed: remaining > 0,
    used,
    remaining,
    message: remaining > 0 ? "" : `Paket Gratis maksimal ${FREE_PRODUCT_LIMIT} produk PO, termasuk produk arsip. Upgrade ke Pro untuk menambah produk.`,
  };
}

export function canViewSummaryMonth(subscription: Subscription, month: string, now = new Date()): boolean {
  return effectivePlan(subscription, now) === "pro" || month === jakartaMonth(now);
}

/** Only new current-month IDs consume restore quota; restoring the same backup is idempotent. */
export function canRestoreOrders(current: AppData, next: AppData, subscription: Subscription, now = new Date()): QuotaCheck {
  const ledger = getUsageLedger();
  const known = new Set([...current.orders.map((order) => order.id), ...ledger.map((entry) => entry.orderId)]);
  const incoming = mergeUsageLedger([], next.orders.filter((order) => !known.has(order.id)), next.batches);
  const month = jakartaMonth(now);
  let used = 0;
  let remaining = 0;
  for (const type of ["jastip", "po"] as const) {
    const newCount = incoming.filter((entry) => entry.month === month && entry.type === type).length;
    const check = canCreateOrders(current, subscription, newCount, now, type);
    if (!check.allowed) return check;
    used += check.used;
    remaining += check.remaining;
  }
  return { allowed: true, used, remaining, message: "" };
}

function normalizeSubscription(value: unknown): Subscription {
  if (!value || typeof value !== "object") return FREE_SUBSCRIPTION;
  const candidate = value as Partial<Subscription>;
  if (candidate.mode !== "demo") return FREE_SUBSCRIPTION;
  if (candidate.tier === "free") return FREE_SUBSCRIPTION;
  if (candidate.tier === "pro" && typeof candidate.expiresAt === "string" && Number.isFinite(Date.parse(candidate.expiresAt))) {
    return { tier: "pro", expiresAt: candidate.expiresAt, mode: "demo" };
  }
  return FREE_SUBSCRIPTION;
}

let snapshot: Subscription | undefined;
const listeners = new Set<() => void>();
let usageSnapshot: OrderUsage[] | undefined;
let usagePersisted = true;
let accountUsage: OrderUsage[] | null = null;
export function setAccountUsage(usage: OrderUsage[] | null) { accountUsage = usage; }

export function normalizeUsageLedger(value: unknown): OrderUsage[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, OrderUsage>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<OrderUsage>;
    if (typeof candidate.orderId !== "string" || !candidate.orderId.length || candidate.orderId.length > 4000 || (candidate.type !== "jastip" && candidate.type !== "po") || typeof candidate.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(candidate.month)) continue;
    if (!unique.has(candidate.orderId)) unique.set(candidate.orderId, { orderId: candidate.orderId, type: candidate.type, month: candidate.month });
  }
  return [...unique.values()];
}

function getUsageLedger(): OrderUsage[] {
  if (accountUsage) return accountUsage;
  if (typeof window === "undefined") return [];
  if (usageSnapshot) return usageSnapshot;
  try {
    usageSnapshot = normalizeUsageLedger(JSON.parse(window.localStorage.getItem(USAGE_STORAGE_KEY) ?? "null"));
    usagePersisted = true;
  } catch {
    usageSnapshot = [];
    usagePersisted = false;
  }
  return usageSnapshot;
}

/** Call with real workspace transactions; demonstration seed rows are filtered by the app. */
export function recordOrderUsage(orders: Order[], batches: Batch[]): boolean {
  const current = getUsageLedger();
  const next = mergeUsageLedger(current, orders, batches);
  if (next.length === current.length && usagePersisted) return true;
  usageSnapshot = next;
  let persisted = true;
  try {
    window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    persisted = false;
  }
  usagePersisted = persisted;
  snapshot = { ...getSnapshot() };
  listeners.forEach((notify) => notify());
  return persisted;
}

function getSnapshot(): Subscription {
  if (snapshot) return snapshot;
  if (typeof window === "undefined") return FREE_SUBSCRIPTION;
  try {
    snapshot = normalizeSubscription(JSON.parse(window.localStorage.getItem(SUBSCRIPTION_STORAGE_KEY) ?? "null"));
  } catch {
    snapshot = FREE_SUBSCRIPTION;
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const refresh = () => {
    // A new reference makes elapsed expiry and Jakarta month rollovers visible to React.
    snapshot = { ...getSnapshot() };
    listeners.forEach((notify) => notify());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === SUBSCRIPTION_STORAGE_KEY || event.key === USAGE_STORAGE_KEY || event.key === null) {
      if (event.key === USAGE_STORAGE_KEY || event.key === null) usageSnapshot = undefined;
      snapshot = undefined;
      snapshot = { ...getSnapshot() };
      listeners.forEach((notify) => notify());
    }
  };
  const onFocus = () => refresh();
  const timer = window.setInterval(refresh, 60_000);
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", onFocus);
  return () => {
    listeners.delete(listener);
    window.clearInterval(timer);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", onFocus);
  };
}

export function useSubscription(): Subscription {
  return useSyncExternalStore(subscribe, getSnapshot, () => FREE_SUBSCRIPTION);
}

function saveSubscription(next: Subscription): boolean {
  let persisted = true;
  snapshot = next;
  try {
    window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    persisted = false;
  }
  listeners.forEach((notify) => notify());
  return persisted;
}

/** Explicit demo activation, with no charge or payment gateway. */
export function startProDemo(now = new Date()): boolean {
  return saveSubscription({ tier: "pro", expiresAt: proExpiry(now), mode: "demo" });
}

export function endProDemo(): boolean {
  return saveSubscription({ ...FREE_SUBSCRIPTION });
}
