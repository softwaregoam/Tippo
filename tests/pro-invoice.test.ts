import { test } from "node:test";
import assert from "node:assert/strict";
import { createProInvoice, parseProInvoice, proInvoiceText } from "../src/lib/pro-invoice.ts";

test("Pro invoice remains a one-month draft and rejects paid or foreign-account documents", () => {
  const invoice = createProInvoice({ id: "owner-a", name: "Titipan Naya", email: "naya@example.test" }, new Date("2026-10-10T18:00:00Z"), "a1b2c3d4-e5f6-4789-8123-aabbccddeeff");
  assert.equal(invoice.id, "INV-PRO-20261011-A1B2C3D4E5F64789");
  assert.equal(parseProInvoice({...invoice,id:"INV-PRO-a1b2c3d4-e5f6-4789-8123-aabbccddeeff"},"owner-a")?.id,invoice.id);
  assert.equal(parseProInvoice({...invoice,id:"INV-PRO-12345678-e5f6-4789-8123-aabbccddeeff"},"owner-a")?.id,"INV-PRO-20261011-12345678E5F64789");
  const account={id:"owner-a",name:"Titipan Naya",email:"naya@example.test"};
  assert.notEqual(createProInvoice(account).id,createProInvoice(account).id);
  assert.equal(invoice.amount, 25000); assert.equal(invoice.months, 1); assert.equal(invoice.status, "draft");
  assert.deepEqual(parseProInvoice(invoice, "owner-a"), invoice);
  assert.equal(parseProInvoice(invoice, "owner-b"), null);
  assert.equal(parseProInvoice({ ...invoice, status: "paid" }, "owner-a"), null);
  assert.equal(parseProInvoice({ ...invoice, amount: 0 }, "owner-a"), null);
  assert.equal(parseProInvoice({ ...invoice, createdAt: "bad-date" }, "owner-a"), null);
  const text = proInvoiceText(invoice);
  assert.match(text, /11 Oktober 2026/); assert.match(text, /01\.00/);
  assert.match(text, /bukan bukti pembayaran/); assert.match(text, /Total: Rp25\.000/);
  assert.match(text, /Pro aktif setelah pembayaran terverifikasi/);
});
