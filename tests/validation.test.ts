import { test } from "node:test";
import assert from "node:assert/strict";
import { isAppData } from "../src/lib/validation.ts";
import { seedData } from "../src/lib/seed.ts";

test("valid demo and an empty workspace can be safely restored", () => {
  assert.equal(isAppData(seedData), true);
  assert.equal(isAppData({ batches: [], customers: [], products: [], orders: [] }), true);
});

test("catalogue validation protects product fields and product references", () => {
  for (const mutate of [
    (d: typeof seedData) => { d.products[0].name = "   "; },
    (d: typeof seedData) => { d.products[0].variant = "x".repeat(4001); },
    (d: typeof seedData) => { d.products[0].sku = "x".repeat(4001); },
    (d: typeof seedData) => { d.products[0].unitPrice = -1; },
    (d: typeof seedData) => { d.products[0].unitCost = 1.5; },
    (d: typeof seedData) => { d.products[0].unitPrice = Number.MAX_SAFE_INTEGER + 1; },
    (d: typeof seedData) => { d.products[1].id = d.products[0].id; },
    (d: typeof seedData) => { d.orders[11].items[0].productId = "missing"; },
    (d: typeof seedData) => { d.orders[0].items[0].productId = d.products[0].id; },
  ]) {
    const data = structuredClone(seedData);
    mutate(data);
    assert.equal(isAppData(data), false);
  }
  const wrongStatus = structuredClone(seedData) as unknown as { products: { active: unknown }[] };
  wrongStatus.products[0].active = "true";
  assert.equal(isAppData(wrongStatus), false);
});

test("archived products and unknown or zero purchase costs remain valid for history", () => {
  const data = structuredClone(seedData);
  data.products[0].active = false;
  data.products[0].unitPrice = 0;
  data.products[0].unitCost = null;
  data.products[1].unitCost = 0;
  assert.equal(isAppData(data), true);
  assert.equal(data.orders[15].items[0].unitPrice, 185000);
  assert.equal(data.orders[15].items[0].unitCost, 105000);
});

test("malformed catalogue or base entities fail safely", () => {
  for (const products of [null, {}, [null], ["product"], [{ id: "bad" }]]) {
    assert.equal(isAppData({ ...seedData, products }), false);
  }
  assert.equal(isAppData({ ...seedData, orders: [null] }), false);
  assert.equal(isAppData({ ...seedData, batches: [1] }), false);
});

test("backup validation preserves relationships, IDs, dates and payment constraints", () => {
  for (const mutate of [
    (d: typeof seedData) => { d.orders[0].customerId = "missing"; },
    (d: typeof seedData) => { d.orders[0].date = "2026-02-30"; },
    (d: typeof seedData) => { d.orders[0].paid = 100000000; },
    (d: typeof seedData) => { d.orders[0].status = "cancelled"; },
    (d: typeof seedData) => { d.orders[1].id = d.orders[0].id; },
    (d: typeof seedData) => { d.customers[0].name = "   "; },
  ]) {
    const data = structuredClone(seedData);
    mutate(data);
    assert.equal(isAppData(data), false);
  }
});

test("individually safe amounts cannot overflow purchase or allocation calculations", () => {
  const data = structuredClone(seedData);
  data.orders[0].items[0].quantity = 1000000;
  data.orders[0].items[0].unitPrice = 0;
  data.orders[0].paid = 0;
  data.orders[0].items[0].unitCost = Number.MAX_SAFE_INTEGER;
  assert.equal(isAppData(data), false);
  data.orders[0].items[0].unitCost = 0;
  data.batches[0].directCosts = Number.MAX_SAFE_INTEGER;
  assert.equal(isAppData(data), false);
});

test("line items require options, unique IDs, bounded counts and a valid creation timestamp", () => {
  for (const mutate of [
    (d: typeof seedData) => { d.orders[0].items = []; },
    (d: typeof seedData) => { d.orders[0].items[0].quantity = 0; },
    (d: typeof seedData) => { d.orders[0].items[0].product = "  "; },
    (d: typeof seedData) => { d.orders[0].items[0].variant = "x".repeat(4001); },
    (d: typeof seedData) => { d.orders[0].items[0].color = "x".repeat(4001); },
    (d: typeof seedData) => { d.orders[0].items[0].size = "x".repeat(4001); },
    (d: typeof seedData) => { d.orders[0].items.push(structuredClone(d.orders[0].items[0])); },
    (d: typeof seedData) => { d.orders[1].items[0].id = d.orders[0].items[0].id; },
    (d: typeof seedData) => { d.orders[0].items = Array.from({ length: 101 }, (_, i) => ({ ...d.orders[0].items[0], id: `item-${i}` })); },
    (d: typeof seedData) => { d.orders[0].createdAt = "2026-02-30T00:00:00+07:00"; },
    (d: typeof seedData) => { d.orders[0].createdAt = "2026-10-07"; },
    (d: typeof seedData) => { d.orders[0].createdAt = "2026-10-07T24:00:00Z"; },
  ]) {
    const data = structuredClone(seedData); mutate(data);
    assert.equal(isAppData(data), false);
  }
  const missingOption = structuredClone(seedData) as unknown as { orders: { items: { size?: string }[] }[] };
  delete missingOption.orders[0].items[0].size;
  assert.equal(isAppData(missingOption), false);
});

test("multiline orders validate combined revenue and whole-order quantity bounds", () => {
  const data = structuredClone(seedData);
  data.orders[0].items.push({ ...data.orders[0].items[0], id: "second-item", variant: "Premium", color: "Hijau", size: "100 g" });
  assert.equal(isAppData(data), true);
  data.orders[0].items[1].unitPrice = Number.MAX_SAFE_INTEGER;
  data.orders[0].items[1].quantity = 1;
  assert.equal(isAppData(data), false);
  data.orders[0].items[1].unitPrice = 0;
  data.orders[0].items[1].unitCost = 0;
  data.orders[0].items[1].quantity = Number.MAX_SAFE_INTEGER;
  assert.equal(isAppData(data), false);
});


test("optional customer addresses preserve old data and reject malformed backups", () => {
  const data = structuredClone(seedData);
  assert.equal(isAppData(data), true);
  data.customers[0].address = "Jalan Melati 12\nBandung";
  assert.equal(isAppData(data), true);
  data.customers[0].address = "";
  assert.equal(isAppData(data), true);
  data.customers[0].address = "x".repeat(1001);
  assert.equal(isAppData(data), false);
  assert.equal(isAppData({...seedData, customers: [{...seedData.customers[0], address: 123}]}), false);
});
