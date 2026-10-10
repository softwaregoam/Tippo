import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateOrders, canCreateProduct, canRestoreOrders, canViewSummaryMonth, effectivePlan,
  FREE_SUBSCRIPTION, jakartaMonth, mergeUsageLedger, monthlyOrderUsage, normalizeUsageLedger, orderUsageForMonth, proExpiry, recordOrderUsage, USAGE_STORAGE_KEY,
} from "../src/lib/subscription.ts";
import type { Subscription } from "../src/lib/subscription.ts";
import type { AppData, Order, Product } from "../src/lib/types.ts";

const now = new Date("2026-10-08T03:00:00Z");
const pro: Subscription = { tier: "pro", expiresAt: "2026-11-08T03:00:00Z", mode: "demo" };
const product: Product = { id: "product-1", name: "Nasi", sku: "NASI", variant: "", unitPrice: 20_000, unitCost: 10_000, active: true };

function order(index: number, overrides: Partial<Order> = {}): Order {
  return {
    id: `order-${index}`, batchId: index % 2 ? "jastip" : "po", customerId: "customer-1",
    createdAt: "2026-10-08T00:00:00Z", date: "2026-10-08", serviceFee: 0,
    shippingCharge: 0, paid: 0, status: "new", notes: "",
    items: [{ id: `item-${index}`, product: "Nasi", variant: "Pedas", color: "", size: "", quantity: 1, unitPrice: 20_000, unitCost: 10_000 }],
    ...overrides,
  };
}

function data(orders: Order[] = [], products: Product[] = []): AppData {
  return {
    batches: ["jastip", "po"].map((id) => ({ id, type: id as "jastip" | "po", name: id, origin: "", closeDate: "2026-10-10", status: "open", directCosts: 0 })),
    orders, products, customers: [],
  };
}

test("Jakarta month resets at midnight WIB, independent of UTC date", () => {
  assert.equal(jakartaMonth(new Date("2026-10-31T16:59:59.999Z")), "2026-10");
  assert.equal(jakartaMonth(new Date("2026-10-31T17:00:00Z")), "2026-11");
  const orders = [order(1, { createdAt: "2026-10-31T16:59:59.999Z" })];
  assert.equal(monthlyOrderUsage(data(orders), new Date("2026-10-31T16:59:59.999Z")), 1);
  assert.equal(monthlyOrderUsage(data(orders), new Date("2026-10-31T17:00:00Z")), 0);
});

test("free quota counts five customer orders per mode, including cancelled and multiitem orders", () => {
  const orders = Array.from({ length: 10 }, (_, index) => order(index));
  orders[0].status = "cancelled";
  orders[1].items.push({ ...orders[1].items[0], id: "second-item" });
  assert.equal(monthlyOrderUsage(data(orders), now), 10);
  assert.equal(monthlyOrderUsage(data(orders), now, "po"), 5);
  const result = canCreateOrders(data(orders), FREE_SUBSCRIPTION, 1, now, "po");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.match(result.message, /5 pesanan/);
});

test("filling Jastip quota leaves all five Open PO slots available", () => {
  const workspace = data(Array.from({ length: 5 }, (_, index) => order(index, { batchId: "jastip" })));
  assert.equal(canCreateOrders(workspace, FREE_SUBSCRIPTION, 1, now, "jastip").allowed, false);
  assert.equal(canCreateOrders(workspace, FREE_SUBSCRIPTION, 5, now, "po").allowed, true);
  assert.equal(canCreateOrders(workspace, FREE_SUBSCRIPTION, 1, now).allowed, false);
});

test("changing transaction date does not evade quota; future-dated orders count when created", () => {
  const orders = [order(1, { date: "2025-01-01" }), order(2, { date: "2027-01-01" }), order(3, { createdAt: "2026-09-30T16:00:00Z", date: "2026-10-08" })];
  assert.equal(monthlyOrderUsage(data(orders), now), 2);
});

test("bulk import must fit the remaining free quota and Pro has no monthly cap", () => {
  const workspace = data([order(1), order(2), order(3)].map((existing) => ({ ...existing, batchId: "jastip" })));
  assert.equal(canCreateOrders(workspace, FREE_SUBSCRIPTION, 2, now, "jastip").allowed, true);
  assert.equal(canCreateOrders(workspace, FREE_SUBSCRIPTION, 3, now, "jastip").allowed, false);
  assert.equal(canCreateOrders(workspace, pro, 1_000, now, "jastip").allowed, true);
  assert.equal(canCreateOrders(workspace, pro, -1, now, "jastip").allowed, false);
});

test("free product limit includes archived records; historical excess is preserved but new records are blocked", () => {
  const products = Array.from({ length: 5 }, (_, index) => ({ ...product, id: `product-${index}`, active: index > 2 }));
  assert.equal(canCreateProduct(data([], products.slice(0, 4)), FREE_SUBSCRIPTION, now).allowed, true);
  assert.equal(canCreateProduct(data([], products), FREE_SUBSCRIPTION, now).allowed, false);
  assert.equal(canCreateProduct(data([], [...products, { ...product, id: "extra" }]), FREE_SUBSCRIPTION, now).remaining, 0);
  assert.equal(canCreateProduct(data([], products), pro, now).allowed, true);
});

test("free summaries allow only the current Jakarta month, Pro allows past months", () => {
  assert.equal(canViewSummaryMonth(FREE_SUBSCRIPTION, "2026-10", now), true);
  assert.equal(canViewSummaryMonth(FREE_SUBSCRIPTION, "2026-09", now), false);
  assert.equal(canViewSummaryMonth(pro, "2026-09", now), true);
});

test("Pro expires at the exact boundary and missing or invalid expiry never grants access", () => {
  assert.equal(effectivePlan(pro, new Date("2026-11-08T02:59:59.999Z")), "pro");
  assert.equal(effectivePlan(pro, new Date("2026-11-08T03:00:00Z")), "free");
  assert.equal(effectivePlan({ ...pro, expiresAt: null }, now), "free");
  assert.equal(effectivePlan({ ...pro, expiresAt: "invalid" }, now), "free");
});

test("one-month expiry clamps month-end and retains the Jakarta time", () => {
  assert.equal(proExpiry(new Date("2026-01-31T16:00:00Z")), "2026-02-28T16:00:00.000Z");
  // 31 January, 00:30 WIB is still 30 January in UTC.
  assert.equal(proExpiry(new Date("2026-01-30T17:30:00Z")), "2026-02-27T17:30:00.000Z");
  assert.equal(proExpiry(new Date("2028-01-30T17:30:00Z")), "2028-02-28T17:30:00.000Z");
  assert.equal(proExpiry(new Date("2026-12-31T10:00:00Z")), "2027-01-31T10:00:00.000Z");
});

test("usage ledger preserves quota after clearing data and restores identical IDs only once", () => {
  const workspace = data(Array.from({ length: 5 }, (_, index) => order(index, { batchId: "jastip" })));
  const ledger = mergeUsageLedger([], workspace.orders, workspace.batches);
  assert.equal(orderUsageForMonth(data(), now, "jastip", ledger), 5);
  assert.equal(orderUsageForMonth(workspace, now, "jastip", ledger), 5);
  assert.equal(mergeUsageLedger(ledger, workspace.orders, workspace.batches).length, 5);
  assert.equal(orderUsageForMonth(data(), new Date("2026-11-01T00:00:00Z"), "jastip", ledger), 0);
});

test("first ledger metadata prevents moving a restored order to another month or mode", () => {
  const original = order(1, { batchId: "jastip" });
  const ledger = mergeUsageLedger([], [original], data().batches);
  const altered = { ...original, batchId: "po", createdAt: "2026-09-01T00:00:00Z" };
  const restored = data([altered]);
  assert.deepEqual(mergeUsageLedger(ledger, restored.orders, restored.batches), ledger);
  assert.equal(orderUsageForMonth(restored, now, "jastip", ledger), 1);
  assert.equal(orderUsageForMonth(restored, now, "po", ledger), 0);
});

test("ledger storage validates metadata, retains valid legacy IDs, and strips extra fields", () => {
  const orderId = "a".repeat(4000);
  assert.deepEqual(normalizeUsageLedger([
    { orderId, type: "jastip", month: "2026-10", customer: "Private data" },
    { orderId, type: "po", month: "2026-09" },
    { orderId: "b".repeat(4001), type: "jastip", month: "2026-10" },
    { orderId: "bad-month", type: "po", month: "2026-13" },
    { orderId: "bad-mode", type: "other", month: "2026-10" },
  ]), [{ orderId, type: "jastip", month: "2026-10" }]);
});

test("restore checks each mode independently, preserves existing IDs, and permits past records", () => {
  const original = Array.from({ length: 5 }, (_, index) => order(index, { batchId: "jastip" }));
  const current = data(original);
  assert.equal(canRestoreOrders(current, data(original), FREE_SUBSCRIPTION, now).allowed, true);
  assert.equal(canRestoreOrders(current, data([...original, order(99, { batchId: "jastip" })]), FREE_SUBSCRIPTION, now).allowed, false);
  assert.equal(canRestoreOrders(current, data([...original, order(99, { batchId: "po" })]), FREE_SUBSCRIPTION, now).allowed, true);
  assert.equal(canRestoreOrders(current, data([...original, order(99, { batchId: "jastip", createdAt: "2026-09-08T03:00:00Z" })]), FREE_SUBSCRIPTION, now).allowed, true);
  assert.equal(canRestoreOrders(current, data([...original, order(99, { batchId: "jastip" })]), pro, now).allowed, true);
});

test("browser ledger blocks quota after reset, deduplicates backup restores, and reports failed writes", () => {
  const values = new Map<string, string>();
  let failWrites = false;
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (failWrites) throw new Error("Storage unavailable");
          values.set(key, value);
        },
      },
    },
  });
  try {
    const workspace = data(Array.from({ length: 5 }, (_, index) => order(index, { batchId: "jastip" })));
    assert.equal(recordOrderUsage(workspace.orders, workspace.batches), true);
    assert.equal(monthlyOrderUsage(data(), now, "jastip"), 5);
    assert.equal(canCreateOrders(data(), FREE_SUBSCRIPTION, 1, now, "jastip").allowed, false);
    assert.equal(canCreateOrders(data(), FREE_SUBSCRIPTION, 5, now, "po").allowed, true);
    assert.equal(canRestoreOrders(data(), workspace, FREE_SUBSCRIPTION, now).allowed, true);
    assert.equal(canRestoreOrders(data(), data([order(99, { batchId: "jastip" })]), FREE_SUBSCRIPTION, now).allowed, false);
    assert.equal(recordOrderUsage(workspace.orders, workspace.batches), true);
    assert.equal(JSON.parse(values.get(USAGE_STORAGE_KEY)!).length, 5);
    assert.deepEqual(Object.keys(JSON.parse(values.get(USAGE_STORAGE_KEY)!)[0]).sort(), ["month", "orderId", "type"]);

    failWrites = true;
    const extra = data([order(99, { batchId: "po" })]);
    assert.equal(recordOrderUsage(extra.orders, extra.batches), false);
    assert.equal(recordOrderUsage(extra.orders, extra.batches), false);
    failWrites = false;
    assert.equal(recordOrderUsage(extra.orders, extra.batches), true);
    assert.equal(JSON.parse(values.get(USAGE_STORAGE_KEY)!).length, 6);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
