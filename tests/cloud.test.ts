import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCloudRecord, cloudErrorMessage } from "../src/lib/cloud.ts";
const data = { batches: [], customers: [], products: [], orders: [] };
test("cloud records never import a demo entitlement or browser workspace", () => {
  const record = parseCloudRecord({ data, version: 2, subscription: { tier: "free", expiresAt: null, mode: "demo" }, usage: [] });
  assert.equal(record.subscription.mode, "live"); assert.equal(record.version, 2);
  assert.throws(() => parseCloudRecord({ data: { ...data, orders: [{}] }, version: 2, subscription: { tier: "free", expiresAt: null }, usage: [] }));
  assert.throws(() => parseCloudRecord({ data, version: -1, subscription: { tier: "free", expiresAt: null }, usage: [] }));
  assert.throws(() => parseCloudRecord({ data, version: 2, subscription: { tier: "admin", expiresAt: null }, usage: [] }));
});
test("cloud errors describe conflicts, quotas, and setup without exposing raw errors", () => {
  assert.match(cloudErrorMessage({ message: "TIPPO_CONFLICT" }), /perangkat lain/);
  assert.match(cloudErrorMessage({ message: "TIPPO_ORDER_LIMIT" }), /5 pesanan/);
  assert.match(cloudErrorMessage({ code: "PGRST202" }), /mengaktifkan database/);
  assert.doesNotMatch(cloudErrorMessage({ message: "sensitive SQL detail" }), /sensitive/);
});
