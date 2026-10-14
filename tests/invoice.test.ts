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

test("WhatsApp invoice includes every item and option, one order fee, and total without payment balances", () => {
  const invoice = buildInvoice(order, batch, customer);
  assert.ok(invoice.includes("No. invoice: INV-ORDER-FIXED"));
  assert.ok(invoice.includes("Tanggal: 8 Oktober 2026"));
  assert.ok(!invoice.includes("Jenis:"));
  assert.ok(!invoice.includes("Status:"));
  assert.ok(!invoice.includes("Batch:"));
  assert.ok(invoice.includes("Pelanggan: Dina"));
  assert.ok(invoice.includes("WhatsApp: 081234567890"));
  assert.ok(invoice.includes("1. Kaos · Oversize · Biru · L"));
  assert.ok(invoice.includes("2. Kimbap · Tuna"));
  assert.ok(invoice.includes(`2 × ${formatCurrency(100000)} = ${formatCurrency(200000)}`));
  assert.ok(invoice.includes(`3 × ${formatCurrency(50000)} = ${formatCurrency(150000)}`));
  assert.ok(invoice.includes(`Ongkir: ${formatCurrency(15000)}`));
  assert.ok(invoice.includes(`Subtotal produk: ${formatCurrency(350000)}`));
  assert.ok(invoice.includes(`*Total tagihan*: ${formatCurrency(390000)}`));
  assert.ok(!invoice.includes("Sudah dibayar:"));
  assert.ok(!invoice.includes("Sisa tagihan"));
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
  assert.ok(!invoice.includes("Status:"));
  assert.ok(invoice.includes(`Total sebelum pembatalan: ${formatCurrency(390000)}`));
  assert.ok(!invoice.includes("Sisa tagihan"));
  assert.ok(invoice.includes("Tidak ada tagihan untuk pesanan ini."));
  assert.ok(!invoice.includes("*Total tagihan*"));
});

test("PO invoices omit jastip fees and balances while preserving totals and stable invoice IDs", () => {
  const paidInvoice = buildInvoice({ ...order, paid: 390000 }, { ...batch, type: "po" }, { ...customer, phone: "" });
  assert.ok(!paidInvoice.includes("Jenis:"));
  assert.ok(!paidInvoice.includes("Sisa tagihan"));
  assert.ok(!paidInvoice.includes("Fee jastip"));
  assert.ok(paidInvoice.includes(`Biaya tambahan: ${formatCurrency(25000)}`));
  assert.ok(!paidInvoice.includes("WhatsApp:"));
  const freeOrder = { ...order, items: order.items.map((item) => ({ ...item, unitPrice: 0 })), serviceFee: 0, shippingCharge: 0, paid: 0 };
  const freeInvoice = buildInvoice(freeOrder);
  assert.ok(freeInvoice.includes(`*Total tagihan*: ${formatCurrency(0)}`));
  assert.ok(freeInvoice.includes("No. invoice: INV-ORDER-FIXED"));
  assert.ok(!freeInvoice.includes("Ongkir:"));
});

test("customer labels containing newlines remain on their own invoice lines", () => {
  const invoice = buildInvoice(order, { ...batch, name: "Batch\nbaru" }, { ...customer, name: "Dina\r\nbaru" });
  assert.ok(!invoice.includes("Batch:"));
  assert.ok(invoice.includes("Pelanggan: Dina baru\n"));
});


test("invoice uses account-specific prefix and only explicitly configured store name",()=>{
 const a=buildInvoice(order,batch,customer,{invoicePrefix:"NAYA",invoiceStoreName:"Toko Naya"});
 const b=buildInvoice(order,batch,customer,{invoicePrefix:"TOKO-B",invoiceStoreName:""});
 assert.ok(a.startsWith("*INVOICE TOKO NAYA*\nNo. invoice: NAYA-ORDER-FIXED"));
 assert.ok(b.startsWith("*INVOICE*\nNo. invoice: TOKO-B-ORDER-FIXED"));
 assert.ok(!b.includes("Toko Naya"));assert.ok(!b.includes("TIPPO"));
 assert.ok(!buildInvoice(order,batch,customer,{invoiceStoreName:"  "}).includes("Toko"));
 assert.ok(buildInvoice({...order,date:"2026-10-09",paid:200000},batch,customer,{invoicePrefix:"NAYA"}).includes("No. invoice: NAYA-ORDER-FIXED"));
 const sanitized=buildInvoice(order,batch,customer,{invoiceStoreName:"Toko\nBaru",invoicePrefix:"INVALID\n"});
 assert.ok(sanitized.includes("*INVOICE TOKO BARU*"));assert.ok(sanitized.includes("No. invoice: INVALID-ORDER-FIXED"));
});


test("normal Open PO invoice has no fee or payment balance lines",()=>{
 const message=buildInvoice({...order,serviceFee:0}, {...batch,type:"po"},customer);
 assert.ok(message.startsWith("*INVOICE*\n"));
 assert.ok(!message.includes("Fee jastip"));assert.ok(!message.includes("Biaya tambahan"));
 assert.ok(!message.includes("Sudah dibayar"));assert.ok(!message.includes("Sisa tagihan"));
 assert.ok(message.includes(`*Total tagihan*: ${formatCurrency(365000)}`));
});

test("LUNAS follows net payments and discounted totals rather than order completion",()=>{
 assert.match(buildInvoice({...order,paid:390000},batch,customer),/\*LUNAS\*/);
 assert.doesNotMatch(buildInvoice({...order,status:"done",paid:100000},batch,customer),/\*LUNAS\*/);
 assert.match(buildInvoice({...order,discount:{type:"amount",value:90000},paid:300000},batch,customer),/\*LUNAS\*/);
 assert.doesNotMatch(buildInvoice({...order,paid:380000,refunds:[{id:"refund",amount:10000,date:order.date,reason:"Pengembalian",createdAt:order.createdAt}]},batch,customer),/\*LUNAS\*/);
 assert.doesNotMatch(buildInvoice({...order,status:"cancelled",paid:0},batch,customer),/\*LUNAS\*/);
});
