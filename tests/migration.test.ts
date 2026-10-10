import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAppData } from "../src/lib/migration.ts";
import { seedData } from "../src/lib/seed.ts";
import type { AppData, Order, Product } from "../src/lib/types.ts";
import { isAppData, type LegacyAppData, type LegacyOrder, type ScalarAppData } from "../src/lib/validation.ts";
import { orderRevenue, orderHpp } from "../src/lib/finance.ts";

function scalarOrder(order: Order): LegacyOrder {
  const { items, createdAt, ...header } = structuredClone(order);
  void createdAt;
  const item = items[0];
  return { ...header, product: item.product, quantity: item.quantity, unitPrice: item.unitPrice, unitCost: item.unitCost, ...(item.productId === undefined ? {} : { productId: item.productId }) };
}

function scalarData(): ScalarAppData {
  return {
    ...structuredClone(seedData),
    orders: seedData.orders.map(scalarOrder),
  };
}

function legacyData(): LegacyAppData {
  const scalar = scalarData();
  const legacy: LegacyAppData = { batches: scalar.batches, customers: scalar.customers, orders: scalar.orders };
  for (const order of legacy.orders) delete order.productId;
  return legacy;
}

function withoutNewFields(data: AppData): LegacyAppData {
  return {
    batches: data.batches, customers: data.customers,
    orders: data.orders.map((order) => {
      const scalar = scalarOrder(order);
      delete scalar.productId;
      return scalar;
    }),
  };
}

test("v1 migration links all PO history and creates stable items without changing transactions", () => {
  const legacy = legacyData();
  const original = structuredClone(legacy);
  legacy.orders[16].unitPrice = 160000;
  legacy.orders[16].unitCost = 95000;
  const normalized = normalizeAppData(legacy);
  assert.ok(normalized);
  assert.equal(isAppData(normalized), true);
  assert.deepEqual(withoutNewFields(normalized), legacy);
  assert.equal(normalized.products.length, 2);
  const poBatchIds = new Set(legacy.batches.filter((batch) => batch.type === "po").map((batch) => batch.id));
  for (const order of normalized.orders) {
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].id, `legacy-item-${order.id}`);
    assert.equal(order.createdAt, `${order.date}T00:00:00+07:00`);
    assert.equal(order.items[0].variant, "");
    assert.equal(order.items[0].color, "");
    assert.equal(order.items[0].size, "");
    if (poBatchIds.has(order.batchId)) {
      const masterProduct: Product | undefined = normalized.products.find((item) => item.id === order.items[0].productId);
      assert.ok(masterProduct);
      assert.equal(masterProduct.name, order.items[0].product);
    } else assert.equal(order.items[0].productId, undefined);
  }
  assert.equal(normalized.products[0].id, "legacy-product-order-012");
  assert.equal(normalized.products[0].unitPrice, 145000);
  assert.equal(normalized.products[0].unitCost, 80000);
  assert.equal(normalized.orders[19].status, "cancelled");
  assert.equal(normalized.orders[19].items[0].productId, "legacy-product-order-016");
  assert.deepEqual(legacy.orders[0], original.orders[0]);
  assert.equal(legacy.orders[11].productId, undefined);
  assert.deepEqual(normalizeAppData(legacy), normalized);
});

test("v2 migration preserves product links, per-order prices, fees, HPP and payments", () => {
  const scalar = scalarData();
  scalar.products[0].name = "Master sekarang berbeda";
  scalar.products[0].variant = "Master varian";
  scalar.products[0].unitPrice = 999000;
  scalar.products[0].active = false;
  const original = structuredClone(scalar);
  const normalized = normalizeAppData(scalar);
  assert.ok(normalized);
  assert.deepEqual(normalized.products, scalar.products);
  for (let i = 0; i < scalar.orders.length; i++) {
    const old = scalar.orders[i];
    const current: Order = normalized.orders[i];
    assert.deepEqual(scalarOrder(current), old);
    assert.equal(orderRevenue(current), old.quantity * old.unitPrice + old.serviceFee + old.shippingCharge);
  }
  assert.deepEqual(scalar, original);
  assert.equal(orderHpp(normalized.orders[12], normalized.orders, normalized.batches), orderHpp(seedData.orders[12], seedData.orders, seedData.batches));
});

test("empty v1, v2 and v3 workspaces stay empty instead of introducing demo data", () => {
  const empty = { batches: [], customers: [], products: [], orders: [] };
  assert.deepEqual(normalizeAppData({ batches: [], customers: [], orders: [] }), empty);
  assert.deepEqual(normalizeAppData(empty), empty);
});

test("a product appearing only in cancelled PO history is still migrated", () => {
  const legacy = legacyData();
  legacy.orders = legacy.orders.filter((order) => order.status === "cancelled");
  const normalized = normalizeAppData(legacy);
  assert.ok(normalized);
  assert.equal(normalized.products.length, 1);
  assert.equal(normalized.products[0].id, "legacy-product-order-020");
  assert.equal(normalized.orders[0].items[0].productId, normalized.products[0].id);
  assert.deepEqual(withoutNewFields(normalized), legacy);
});

test("current multiline snapshots, variants and creation times survive catalogue edits", () => {
  const data = structuredClone(seedData);
  data.orders[0].items.push({ ...data.orders[0].items[0], id: "second-item", variant: "Premium", color: "Hijau", size: "200 g" });
  data.orders[0].createdAt = "2026-05-09T10:11:12.123Z";
  const orderSnapshots = structuredClone(data.orders);
  data.products[0].name = "Nama baru";
  data.products[0].unitPrice = 999000;
  data.products[0].unitCost = null;
  data.products[0].active = false;
  assert.equal(isAppData(data), true);
  assert.strictEqual(normalizeAppData(data), data);
  assert.deepEqual(data.orders, orderSnapshots);
});

test("corrupt backups or dangling product links cannot be downgraded to legacy data", () => {
  const invalidLegacy = legacyData(); invalidLegacy.orders[0].paid = 999999999;
  const danglingLegacy = legacyData(); danglingLegacy.orders[11].productId = "missing";
  const invalidV2 = scalarData(); invalidV2.orders[11].productId = "missing";
  const invalidCurrent = structuredClone(seedData); invalidCurrent.orders[11].items[0].productId = "missing";
  const jastipLink = structuredClone(seedData); jastipLink.orders[0].items[0].productId = jastipLink.products[0].id;
  const corruptItems = { ...scalarData(), orders: scalarData().orders.map((o) => ({ ...o, items: [] })) };
  const corruptTimestamp = { ...scalarData(), orders: scalarData().orders.map((o) => ({ ...o, createdAt: "bad" })) };
  const missingTime = structuredClone(seedData) as unknown as { orders: { createdAt?: string }[] };
  delete missingTime.orders[0].createdAt;
  const mixed = { ...seedData, orders: [{ ...seedData.orders[0], product: "Ignored scalar" }] };
  for (const corrupt of [null, {}, [], invalidLegacy, danglingLegacy, invalidV2, invalidCurrent, jastipLink, corruptItems, corruptTimestamp, missingTime, mixed,
    { ...legacyData(), products: null }, { ...legacyData(), products: undefined }, { ...legacyData(), orders: [null] }]) {
    assert.equal(normalizeAppData(corrupt), null);
  }
});
