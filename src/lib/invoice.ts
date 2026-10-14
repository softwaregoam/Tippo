import { refundedTotal } from "./refund.ts";
import { formatCurrency, itemLabel, orderDiscount, orderRevenue } from "./finance.ts";
import { readBusinessProfile, type InvoiceSettings } from "./business-profile.ts";
import type { Batch, Customer, Order } from "./types.ts";

function textLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function invoiceDate(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(value.getTime()) ? date : new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(value);
}

/** A customer-facing WhatsApp message. Purchase costs and internal notes stay private. */
export function buildInvoice(order: Order, batch?: Batch, customer?: Customer, settings?: Partial<InvoiceSettings>): string {
  const profile = readBusinessProfile(settings);
  const cancelled = order.status === "cancelled";
  const total = orderRevenue(order);
  const lines = [
    `*INVOICE${profile.invoiceStoreName ? ` ${textLine(profile.invoiceStoreName).toLocaleUpperCase("id-ID")}` : ""}*`,
    `No. invoice: ${profile.invoicePrefix}-${textLine(order.id).toUpperCase()}`,
    `Tanggal: ${invoiceDate(order.date)}`,
    `Pelanggan: ${textLine(customer?.name ?? "Pelanggan")}`,
    ...(customer?.phone ? [`WhatsApp: ${textLine(customer.phone)}`] : []),
    "",
    "*Rincian pesanan*",
    ...order.items.flatMap((item, index) => [
      `${index + 1}. ${textLine(itemLabel(item))}`,
      `   ${item.quantity} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.quantity * item.unitPrice)}`,
    ]),
    "",
    `Subtotal produk: ${formatCurrency(order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))}`,
    ...(batch?.type === "po" ? order.serviceFee > 0 ? [`Biaya tambahan: ${formatCurrency(order.serviceFee)}`] : [] : [`Fee jastip: ${formatCurrency(order.serviceFee)}`]),
    ...(orderDiscount(order) > 0 ? [`Diskon${order.discount?.type === "percent" ? ` (${order.discount.value}%)` : ""}: -${formatCurrency(orderDiscount(order))}`] : []),
    `Ongkir: ${formatCurrency(order.shippingCharge)}`,
    `${cancelled ? "Total sebelum pembatalan" : "*Total tagihan*"}: ${formatCurrency(total)}`,
    ...(refundedTotal(order) > 0 ? [`Refund: ${formatCurrency(refundedTotal(order))}`] : []),
    "",
    cancelled ? "Pesanan dibatalkan. Tidak ada tagihan untuk pesanan ini." : "Terima kasih sudah memesan!",
  ];
  return lines.join("\n");
}
