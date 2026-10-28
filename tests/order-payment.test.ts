import { test } from "node:test";
import assert from "node:assert/strict";
import { seedData } from "../src/lib/seed.ts";
import { addOrderPayment } from "../src/lib/order-payment.ts";
import { orderRevenue, outstanding } from "../src/lib/finance.ts";

const order = { ...seedData.orders[0], paid: 1000, status: "done" as const };

test("additional payments accumulate without altering completion, refunds or product snapshots", () => {
  const before = structuredClone(order);
  const next = addOrderPayment(order, 5000);
  assert.deepEqual(next, { ...order, paid: 6000 });
  assert.deepEqual(order, before);
  const settled = addOrderPayment(next, outstanding(next));
  assert.equal(settled.paid, orderRevenue(order));
  assert.equal(outstanding(settled), 0);
  assert.equal(settled.status, "done");
});

test("payments reject invalid amounts, overpayment, settled orders, cancellations and personal purchases", () => {
  for (const amount of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, outstanding(order) + 1]) {
    assert.throws(() => addOrderPayment(order, amount));
  }
  assert.throws(() => addOrderPayment({ ...order, paid: orderRevenue(order) }, 1));
  assert.throws(() => addOrderPayment({ ...order, status: "cancelled", paid: 0 }, 1));
  assert.throws(() => addOrderPayment({ ...order, purpose: "personal", paid: 0 }, 1));
});

test("settlement uses the discounted bill including shipping and preserves refund history", () => {
  const discounted = { ...order, discount: { type: "percent" as const, value: 25 }, shippingCharge: 10000, refunds: [{ id: "refund", amount: 500, reason: "Koreksi", date: "2026-10-28", createdAt: "2026-10-28T00:00:00Z" }] };
  const next = addOrderPayment(discounted, outstanding(discounted));
  assert.equal(next.paid, orderRevenue(discounted));
  assert.deepEqual(next.refunds, discounted.refunds);
});
