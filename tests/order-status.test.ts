import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleOrderStatus } from "../src/lib/order-status.ts";

test("unfinished legacy statuses display as processing while terminal statuses stay distinct", () => {
  for (const status of ["new", "purchased", "ready", "shipped"] as const) {
    assert.equal(visibleOrderStatus(status), "new");
  }
  assert.equal(visibleOrderStatus("done"), "done");
  assert.equal(visibleOrderStatus("cancelled"), "cancelled");
});
