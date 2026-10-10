import assert from "node:assert/strict";
import test from "node:test";
import { formatCurrency } from "../src/lib/finance.ts";
import { buildInvoice } from "../src/lib/invoice.ts";
import type { Batch, Customer, Order } from "../src/lib/types.ts";

const batch: Batch = { id: "batch-a", name: "Seoul Oktober", type: "jastip", origin: "Seoul", closeDate: "2026-10-20", status: "open", directCosts: 543210 };
const customer: Customer = { id: "customer-a", name: "Dina", phone: "081234567890" };
const order: Order = {
  id: "order-fixed", batchId: batch.id, customerId: customer.id,
  items: [
    { id: "item-a", product: "Kaos", variant: "Oversize", color: "Biru", size: "L", quantity: 2, unitPrice: 100000, unitCost: 73123 },
    { id: "item-b", product: "Kimbap", variant: "Tuna", color: "", size: "", quantity: 3, unitPrice: 50000, unitCost: null },
  ],
  createdAt: "2026-10-08T01:00:00.000Z", serviceFee: 25000, shippingCharge: 15000,
  paid: 100000, date: "2026-10-08", status: "new", notes: "INTERNAL: supplier rahasia",
};

test("WhatsApp invoice includes every item and option, one order fee, and partial payment", () => {
  const invoice = buildInvoice(order, batch, customer);
  assert.ok(invoice.includes("No. invoice: TIP-ORDER-FIXED"));
  assert.ok(invoice.includes("Tanggal: 8 Oktober 2026"));
  assert.ok(invoice.includes("Jenis: Jastip"));
  assert.ok(invoice.includes("Pelanggan: Dina"));
  assert.ok(invoice.includes("WhatsApp: 081234567890"));
  assert.ok(invoice.includes("1. Kaos · Oversize · Biru · L"));
  assert.ok(invoice.includes("2. Kimbap · Tuna"));
  assert.ok(invoice.includes(`2 × ${formatCurrency(100000)} = ${formatCurrency(200000)}`));
  assert.ok(invoice.includes(`3 × ${formatCurrency(50000)} = ${formatCurrency(150000)}`));
  assert.ok(invoice.includes(`Subtotal barang: ${formatCurrency(350000)}`));
  assert.ok(invoice.includes(`*Total tagihan*: ${formatCurrency(390000)}`));
  assert.ok(invoice.includes(`Sudah dibayar: ${formatCurrency(100000)}`));
  assert.ok(invoice.includes(`*Sisa tagihan*: ${formatCurrency(290000)}`));
  assert.equal(invoice.match(/Fee jastip:/g)?.length, 1);
});

test("customer invoice excludes purchase costs, batch costs, and private notes", () => {
  const invoice = buildInvoice(order, batch, customer);
  for (const privateValue of ["73.123", "543.210", "supplier rahasia", "INTERNAL", "HPP", "harga beli", "unitCost", "directCosts"]) {
    assert.ok(!invoice.includes(privateValue), privateValue);
  }
});

test("cancelled invoice displays cancellation and never asks for an outstanding balance", () => {
  const invoice = buildInvoice({ ...order, paid: 0, status: "cancelled" }, batch, customer);
  assert.ok(invoice.includes("Status: Dibatalkan"));
  assert.ok(invoice.includes(`Total sebelum pembatalan: ${formatCurrency(390000)}`));
  assert.ok(invoice.includes(`*Sisa tagihan*: ${formatCurrency(0)}`));
  assert.ok(invoice.includes("Tidak ada tagihan untuk pesanan ini."));
  assert.ok(!invoice.includes("*Total tagihan*"));
});

test("fully paid and zero value PO orders show zero remaining and preserve stable invoice IDs", () => {
  const paidInvoice = buildInvoice({ ...order, paid: 390000 }, { ...batch, type: "po" }, { ...customer, phone: "" });
  assert.ok(paidInvoice.includes("Jenis: Open PO"));
  assert.ok(paidInvoice.includes(`*Sisa tagihan*: ${formatCurrency(0)}`));
  assert.ok(!paidInvoice.includes("WhatsApp:"));
  const freeOrder = { ...order, items: order.items.map((item) => ({ ...item, unitPrice: 0 })), serviceFee: 0, shippingCharge: 0, paid: 0 };
  const freeInvoice = buildInvoice(freeOrder);
  assert.ok(freeInvoice.includes(`*Total tagihan*: ${formatCurrency(0)}`));
  assert.ok(freeInvoice.includes("No. invoice: TIP-ORDER-FIXED"));
});

test("customer labels containing newlines remain on their own invoice lines", () => {
  const invoice = buildInvoice(order, { ...batch, name: "Batch\nbaru" }, { ...customer, name: "Dina\r\nbaru" });
  assert.ok(invoice.includes("Batch: Batch baru\n"));
  assert.ok(invoice.includes("Pelanggan: Dina baru\n"));
});
