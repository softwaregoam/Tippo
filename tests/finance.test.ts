import assert from "node:assert/strict";
import test from "node:test";
import {
  allocatedBatchCosts,
  getMonthlySeries,
  getMonthSummary,
  orderHpp,
  orderMargin,
  orderLabel,
  orderQuantity,
  itemLabel,
  orderRevenue,
  orderNetSales,
  outstanding,
} from "../src/lib/finance.ts";
import type { AppData, Batch, Order, OrderItem } from "../src/lib/types.ts";

const batch: Batch = {
  id: "batch-a", name: "Test PO", type: "po", origin: "Bandung",
  closeDate: "2026-10-20", status: "open", directCosts: 100,
};

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return { id: "line-a", product: "Tote", variant: "", color: "", size: "", quantity: 1, unitPrice: 1000, unitCost: 600, ...overrides };
}

function makeOrder(overrides: Partial<Order> = {}, itemOverrides: Partial<OrderItem> = {}): Order {
  return {
    id: "a", batchId: batch.id, customerId: "customer-a",
    items: [makeItem({ id: `line-${overrides.id ?? "a"}`, ...itemOverrides })], serviceFee: 100,
    createdAt: "2026-10-07T09:00:00+07:00",
    shippingCharge: 200, paid: 500, date: "2026-10-07", status: "new", notes: "",
    ...overrides,
  };
}

test("largest-remainder allocation conserves costs and breaks ties by ID", () => {
  const orders = [makeOrder({ id: "c" }), makeOrder({ id: "a" }), makeOrder({ id: "b" })];
  const allocation = allocatedBatchCosts(batch, orders);
  assert.deepEqual(allocation, { a: 34, b: 33, c: 33 });
  assert.equal(Object.values(allocation).reduce((sum, amount) => sum + amount, 0), 100);
  assert.deepEqual(allocatedBatchCosts(batch, [...orders].reverse()), allocation);
});

test("allocation weights quantity and excludes cancelled and other-batch orders", () => {
  const orders = [
    makeOrder({ id: "a" }, { quantity: 1 }),
    makeOrder({ id: "b" }, { quantity: 2, unitCost: null }),
    makeOrder({ id: "cancelled", status: "cancelled" }, { quantity: 10 }),
    makeOrder({ id: "other", batchId: "other" }, { quantity: 10 }),
  ];
  assert.deepEqual(allocatedBatchCosts(batch, orders), { b: 67, a: 33 });
  assert.deepEqual(allocatedBatchCosts(batch, []), {});
  assert.deepEqual(allocatedBatchCosts(batch, [makeOrder({}, { quantity: 0 })]), {});
});

test("HPP includes allocated cost while payments remain separate from revenue and margin", () => {
  const order = makeOrder({}, { quantity: 2 });
  assert.equal(orderRevenue(order), 2300);
  assert.equal(orderHpp(order, [order], [batch]), 1300);
  assert.equal(orderMargin(order, [order], [batch]), 800);
  assert.equal(outstanding(order), 1800);
  const fullyPaid = { ...order, paid: 2300 };
  assert.equal(orderRevenue(fullyPaid), orderRevenue(order));
  assert.equal(orderMargin(fullyPaid, [fullyPaid], [batch]), 800);
  assert.equal(outstanding(fullyPaid), 0);
  assert.equal(outstanding({ ...order, paid: 9999 }), 0);
});

test("unknown purchase cost stays unknown; zero is known and a missing batch is safe", () => {
  const unknown = makeOrder({}, { unitCost: null });
  assert.equal(orderHpp(unknown, [unknown], [batch]), null);
  assert.equal(orderMargin(unknown, [unknown], [batch]), null);
  const free = makeOrder({}, { unitCost: 0 });
  assert.equal(orderHpp(free, [free], [batch]), 100);
  assert.equal(orderHpp(makeOrder({ batchId: "missing" }), [], [batch]), 600);
  assert.equal(orderHpp({ ...unknown, status: "cancelled" }, [unknown], [batch]), 0);
  assert.equal(orderMargin({ ...unknown, status: "cancelled" }, [unknown], [batch]), 0);
});

test("monthly totals exclude cancelled orders and disclose partial profit", () => {
  const orders = [
    makeOrder({ id: "known", paid: 500 }),
    makeOrder({ id: "unknown", paid: 200 }, { unitCost: null }),
    makeOrder({ id: "cancelled", status: "cancelled", paid: 0 }),
    makeOrder({ id: "september", date: "2026-09-30", paid: 1300 }),
  ];
  const data: AppData = { batches: [batch], customers: [], orders, products: [] };
  // Three active units share the cost across the whole batch, including September.
  assert.deepEqual(getMonthSummary(data, "2026-10"), {
    personalExpenses:0,
    revenue: 2600, hpp: 634, profit: 466, received: 700,
    outstanding: 1900, ordersCount: 2, unknownCostCount: 1,
  });
  const series = getMonthlySeries(data, 2026);
  assert.equal(series.length, 12);
  assert.equal(series[9].month, "2026-10");
  assert.equal(series[9].label, "Okt");
  assert.equal(series[9].profit, 466);
  assert.equal(series[8].ordersCount, 1);
  assert.equal(series[0].revenue, 0);
});

test("allocation preserves whole rupiah across varied quantities and low costs", () => {
  for (const directCosts of [0, 1, 2, 11, 101, 420000]) {
    const orders = [makeOrder({ id: "a" }, { quantity: 2 }), makeOrder({ id: "b" }, { quantity: 7 }), makeOrder({ id: "c" }, { quantity: 4 })];
    const allocation = allocatedBatchCosts({ ...batch, directCosts }, orders);
    assert.equal(Object.values(allocation).reduce((sum, amount) => sum + amount, 0), directCosts);
    for (const amount of Object.values(allocation)) assert.ok(Number.isInteger(amount) && amount >= 0);
  }
});

test("one order totals several item snapshots but fees and shipping are charged once", () => {
  const order = makeOrder({ items: [
    makeItem({ id: "line-a", product: "Nasi", variant: "Pedas", quantity: 2, unitPrice: 20000, unitCost: 12000 }),
    makeItem({ id: "line-b", product: "Kaos", color: "Navy", size: "L", quantity: 1, unitPrice: 100000, unitCost: 60000 }),
  ], serviceFee: 5000, shippingCharge: 10000, paid: 50000 });
  const other = makeOrder({ id: "b" });
  assert.equal(itemLabel(order.items[1]), "Kaos · Navy · L");
  assert.equal(orderLabel(order), "Nasi · Pedas, Kaos · Navy · L");
  assert.equal(orderQuantity(order), 3);
  assert.equal(orderRevenue(order), 155000);
  assert.deepEqual(allocatedBatchCosts(batch, [order, other]), { a: 75, b: 25 });
  assert.equal(orderHpp(order, [order, other], [batch]), 84075);
  assert.equal(orderMargin(order, [order, other], [batch]), 60925);
  assert.equal(outstanding(order), 105000);
});

test("an unknown cost on any line keeps the whole order HPP and margin unknown", () => {
  const order = makeOrder({ items: [makeItem(), makeItem({ id: "line-b", unitCost: null })] });
  assert.equal(orderRevenue(order), 2300);
  assert.equal(orderHpp(order, [order], [batch]), null);
  const data: AppData = { batches: [batch], customers: [], products: [], orders: [order] };
  assert.deepEqual(getMonthSummary(data, "2026-10"), {
    personalExpenses:0,
    revenue: 2300, hpp: 0, profit: 0, received: 500, outstanding: 1800, ordersCount: 1, unknownCostCount: 1,
  });
});


test("shipping never increases profit, including fixed discounts that reach shipping",()=>{
 for(const type of ["jastip","po"] as const)for(const discount of [undefined,{type:"amount" as const,value:500},{type:"percent" as const,value:10},{type:"amount" as const,value:1000}]){
  const base=makeOrder({discount,serviceFee:type==="jastip"?100:0});
  const net=orderNetSales(base),cost=orderHpp(base,[base],[{...batch,type}])!;
  for(const shippingCharge of [0,200,10000]){
   const row={...base,shippingCharge},data={batches:[{...batch,type}],orders:[row],customers:[],products:[]};
   assert.equal(orderNetSales(row),net);assert.equal(orderMargin(row,[row],data.batches),net-cost);
   assert.equal(getMonthSummary(data,"2026-10").profit,net-cost);
   assert.equal(outstanding(row),Math.max(0,orderRevenue(row)-row.paid));
  }
 }
 const free=makeOrder({discount:{type:"amount",value:1300}});
 assert.equal(orderRevenue(free),0);assert.equal(orderNetSales(free),0);assert.equal(orderMargin(free,[free],[batch]),-700);
});
