import { test } from "node:test";
import assert from "node:assert/strict";
import { canChangeBatchStatus, nextBatchStatus } from "../src/lib/batch-status.ts";

test("batch status cannot reopen, skip closure or change after completion", () => {
  assert.equal(nextBatchStatus("open"), "closed");
  assert.equal(nextBatchStatus("closed"), "completed");
  assert.equal(nextBatchStatus("completed"), null);
  for (const from of ["open", "closed", "completed"] as const) {
    for (const to of ["open", "closed", "completed"] as const) {
      assert.equal(canChangeBatchStatus(from, to), from === to || from === "open" && to === "closed" || from === "closed" && to === "completed");
    }
  }
});
