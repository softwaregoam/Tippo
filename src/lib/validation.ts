import type { AppData, Order } from "./types.ts";

/** Scalar snapshots used only when reading validated v1/v2 backups. */
export type LegacyOrder = Omit<Order, "items" | "createdAt"> & {
  productId?: string | null;
  product: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
};
export type LegacyAppData = Omit<AppData, "products" | "orders"> & { orders: LegacyOrder[] };
export type ScalarAppData = Omit<AppData, "orders"> & { orders: LegacyOrder[] };

const MAX_TEXT_LENGTH = 4000;
export const LEGACY_PRODUCT_PREFIX = "legacy-product-";
export const LEGACY_ITEM_PREFIX = "legacy-item-";
export const MAX_ORDER_ITEMS = 100;
const money = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_TEXT_LENGTH;
const id = (v: unknown): v is string => text(v) && v.length > 0;
const extendedId = (v: unknown, prefix: string): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_TEXT_LENGTH + prefix.length;
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const validDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
};
const timestamp = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)) return false;
  return validDate(v.slice(0, 10)) && !Number.isNaN(new Date(v).valueOf());
};

function baseWorkspace(value: unknown): value is Record<string, unknown> & {
  batches: AppData["batches"]; customers: AppData["customers"]; orders: unknown[];
} {
  if (!record(value)) return false;
  const { batches, customers, orders } = value;
  if (!Array.isArray(batches) || !Array.isArray(customers) || !Array.isArray(orders)) return false;
  if (batches.length > 10000 || customers.length > 10000 || orders.length > 100000) return false;
  if (!batches.every((b) => record(b) && id(b.id) && text(b.name) && b.name.trim() && text(b.origin) && validDate(b.closeDate) && ["jastip", "po"].includes(b.type as string) && ["open", "closed", "completed"].includes(b.status as string) && money(b.directCosts))) return false;
  if (!customers.every((c) => record(c) && id(c.id) && text(c.name) && c.name.trim() && text(c.phone) && (c.address === undefined || (text(c.address) && c.address.length <= 1000)))) return false;
  return new Set(batches.map((b) => b.id)).size === batches.length && new Set(customers.map((c) => c.id)).size === customers.length;
}

function catalogue(value: unknown): value is AppData["products"] {
  if (!Array.isArray(value) || value.length > 100000) return false;
  if (!value.every((p) => record(p) && extendedId(p.id, LEGACY_PRODUCT_PREFIX) && text(p.name) && p.name.trim() && text(p.variant) && text(p.sku) && (p.category === undefined || (text(p.category) && p.category.length <= 80)) && money(p.unitPrice) && (p.unitCost === null || money(p.unitCost)) && typeof p.active === "boolean")) return false;
  return new Set(value.map((p) => p.id)).size === value.length;
}

function validRefunds(order: Record<string, unknown>) {
  if (order.refunds === undefined) return true;
  if (!Array.isArray(order.refunds) || order.refunds.length > 100) return false;
  let total = typeof order.paid === "number" ? order.paid : NaN;
  const ids = new Set<string>();
  for (const entry of order.refunds) {
    if (!record(entry) || !id(entry.id) || ids.has(entry.id) || !money(entry.amount) || entry.amount === 0 || !validDate(entry.date) || !text(entry.reason) || entry.reason.length > 1000 || !text(entry.createdAt) || !Number.isFinite(Date.parse(entry.createdAt))) return false;
    ids.add(entry.id); total += entry.amount;
    if (!Number.isSafeInteger(total)) return false;
  }
  return true;
}

function validOrderHeader(order: Record<string, unknown>, batchIds: Set<string>, customerIds: Set<string>) {
  return validRefunds(order) && id(order.id) && typeof order.batchId === "string" && batchIds.has(order.batchId) && typeof order.customerId === "string" && customerIds.has(order.customerId) && money(order.serviceFee) && money(order.shippingCharge) && money(order.paid) && validDate(order.date) && ["new", "purchased", "ready", "shipped", "done", "cancelled"].includes(order.status as string) && text(order.notes) && (order.status !== "cancelled" || order.paid === 0);
}

/** Aggregate bounds protect all revenue, HPP and largest-remainder arithmetic. */
function safeAggregates(batches: AppData["batches"], orders: { batchId: string; quantity: number; revenue: number; purchase: number }[]) {
  const batchCosts = new Map(batches.map((b) => [b.id, b.directCosts]));
  let totalRevenue = 0, totalPurchase = 0, totalQuantity = 0;
  for (const order of orders) {
    if (![order.quantity, order.revenue, order.purchase, order.quantity * (batchCosts.get(order.batchId) ?? 0)].every(Number.isSafeInteger)) return false;
    totalRevenue += order.revenue;
    totalPurchase += order.purchase;
    totalQuantity += order.quantity;
  }
  const totalDirect = batches.reduce((sum, batch) => sum + batch.directCosts, 0);
  return [totalRevenue, totalPurchase, totalQuantity, totalDirect, totalPurchase + totalDirect].every(Number.isSafeInteger);
}

function scalarWorkspace(value: unknown): value is LegacyAppData | ScalarAppData {
  if (!baseWorkspace(value)) return false;
  const batchIds = new Set(value.batches.map((b) => b.id));
  const customerIds = new Set(value.customers.map((c) => c.id));
  if (!value.orders.every((o) => record(o) && !("items" in o) && !("createdAt" in o) && validOrderHeader(o, batchIds, customerIds) && text(o.product) && o.product.trim() && money(o.quantity) && o.quantity > 0 && money(o.unitPrice) && (o.unitCost === null || money(o.unitCost)) && Number.isSafeInteger(o.quantity * o.unitPrice + (o.serviceFee as number) + (o.shippingCharge as number)) && (o.paid as number) <= o.quantity * o.unitPrice + (o.serviceFee as number) + (o.shippingCharge as number))) return false;
  const orders = value.orders as LegacyOrder[];
  if (new Set(orders.map((o) => o.id)).size !== orders.length) return false;
  return safeAggregates(value.batches, orders.map((o) => ({ batchId: o.batchId, quantity: o.quantity, revenue: o.quantity * o.unitPrice + o.serviceFee + o.shippingCharge, purchase: o.quantity * (o.unitCost ?? 0) })));
}

/** Only scalar workspaces without a catalogue qualify for v1 migration. */
export function isLegacyAppData(value: unknown): value is LegacyAppData {
  if (!scalarWorkspace(value) || "products" in value) return false;
  return value.orders.every((order) => order.productId === undefined || order.productId === null);
}

/** A v2 workspace must validate before any of its scalar snapshots are migrated. */
export function isScalarAppData(value: unknown): value is ScalarAppData {
  if (!scalarWorkspace(value) || !("products" in value) || !catalogue(value.products)) return false;
  const productIds = new Set(value.products.map((p) => p.id));
  const batchTypes = new Map(value.batches.map((b) => [b.id, b.type]));
  return value.orders.every((o) => o.productId === undefined || o.productId === null || (extendedId(o.productId, LEGACY_PRODUCT_PREFIX) && productIds.has(o.productId) && batchTypes.get(o.batchId) === "po"));
}

/** The current format always has an item list and a valid immutable creation time. */
export function isAppData(value: unknown): value is AppData {
  if (!baseWorkspace(value) || !("products" in value) || !catalogue(value.products)) return false;
  const batchIds = new Set(value.batches.map((b) => b.id));
  const customerIds = new Set(value.customers.map((c) => c.id));
  const productIds = new Set(value.products.map((p) => p.id));
  const batchTypes = new Map(value.batches.map((b) => [b.id, b.type]));
  const allItemIds = new Set<string>();
  const orderIds = new Set<string>();
  let totalRefunds = 0;
  const aggregates: { batchId: string; quantity: number; revenue: number; purchase: number }[] = [];
  for (const order of value.orders) {
    if (!record(order) || !validOrderHeader(order, batchIds, customerIds) || !timestamp(order.createdAt) || !Array.isArray(order.items) || !order.items.length || order.items.length > MAX_ORDER_ITEMS) return false;
    totalRefunds += (order.refunds as {amount:number}[] | undefined)?.reduce((sum,entry)=>sum+entry.amount,0) ?? 0;
    if (!Number.isSafeInteger(totalRefunds)) return false;
    // Reject ambiguous mixed scalar/current snapshots rather than picking one silently.
    if (["product", "productId", "quantity", "unitPrice", "unitCost"].some((key) => key in order)) return false;
    if (orderIds.has(order.id as string)) return false;
    orderIds.add(order.id as string);
    let quantity = 0, revenue = (order.serviceFee as number) + (order.shippingCharge as number), purchase = 0;
    for (const item of order.items) {
      if (!record(item) || !extendedId(item.id, LEGACY_ITEM_PREFIX) || allItemIds.has(item.id) || !text(item.product) || !item.product.trim() || !text(item.variant) || !text(item.color) || !text(item.size) || !money(item.quantity) || item.quantity <= 0 || !money(item.unitPrice) || !(item.unitCost === null || money(item.unitCost))) return false;
      if (!(item.productId === undefined || item.productId === null || (extendedId(item.productId, LEGACY_PRODUCT_PREFIX) && productIds.has(item.productId) && batchTypes.get(order.batchId as string) === "po"))) return false;
      allItemIds.add(item.id);
      const lineRevenue = item.quantity * item.unitPrice;
      const linePurchase = item.quantity * (item.unitCost ?? 0);
      if (!Number.isSafeInteger(lineRevenue) || !Number.isSafeInteger(linePurchase)) return false;
      quantity += item.quantity;
      revenue += lineRevenue;
      purchase += linePurchase;
    }
    if (![quantity, revenue, purchase].every(Number.isSafeInteger) || (order.paid as number) > revenue) return false;
    aggregates.push({ batchId: order.batchId as string, quantity, revenue, purchase });
  }
  return safeAggregates(value.batches, aggregates);
}
