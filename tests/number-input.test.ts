import assert from "node:assert/strict";
import test from "node:test";
import { formatNumberInput, parseNumberInput } from "../src/lib/number-input.ts";

test("Indonesian grouping preserves exact digits, empty and zero", () => {
  for (const raw of ["", "0", "150000", "123456789012345678901"]) {
    assert.equal(parseNumberInput(formatNumberInput(raw)), raw);
  }
  assert.equal(formatNumberInput("150000"), "150.000");
});
test("invalid negative and decimal amounts are not silently changed", () => {
  for (const value of ["-100", "1.5", "1,5", "abc"]) assert.equal(parseNumberInput(value), value);
  assert.equal(parseNumberInput("150.000"), "150000");
  assert.equal(parseNumberInput("15.00", true), "1500");
});
