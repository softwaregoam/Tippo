import { invoiceBankDetails, readInvoiceAppearance } from "./invoice-template.ts";
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

export function isInvoicePaid(order: Order): boolean {
  return order.status !== "cancelled" && order.paid >= orderRevenue(order);
}

/** A customer-facing WhatsApp message. Purchase costs stay private. Order notes are customer-facing. */
export function buildInvoice(order: Order, batch?: Batch, customer?: Customer, settings?: Partial<InvoiceSettings>): string {
  const profile = readBusinessProfile(settings);
  const appearance=readInvoiceAppearance(settings?.appearance),footer=appearance.footer,bank=invoiceBankDetails(appearance);
  const cancelled = order.status === "cancelled";
  const total = orderRevenue(order);
  const lines = [
    `*INVOICE${profile.invoiceStoreName ? ` ${textLine(profile.invoiceStoreName).toLocaleUpperCase("id-ID")}` : ""}*`,
    `No. invoice: ${profile.invoicePrefix}-${textLine(order.id).toUpperCase()}`,
    `Tanggal: ${invoiceDate(order.date)}`,
    `Pelanggan: ${textLine(customer?.name ?? "Pelanggan")}`,
    ...(customer?.phone ? [`WhatsApp: ${textLine(customer.phone)}`] : []),
    ...(customer?.address?.trim() ? [`Alamat: ${textLine(customer.address)}`] : []),
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
    ...(order.shippingCharge > 0 ? [`Ongkir: ${formatCurrency(order.shippingCharge)}`] : []),
    `${cancelled ? "Total sebelum pembatalan" : "*Total tagihan*"}: ${formatCurrency(total)}`,
    ...(refundedTotal(order) > 0 ? [`Refund: ${formatCurrency(refundedTotal(order))}`] : []),
    ...(isInvoicePaid(order) ? ["*LUNAS*"] : []),
    "",
    ...((order.shippingDate||order.shippingTime||order.shippingMethod?.trim()) ? ["*Pengiriman*",...(order.shippingDate ? [`Tanggal kirim: ${invoiceDate(order.shippingDate)}`] : []),...(order.shippingTime ? [`Jam kirim: ${order.shippingTime}`] : []),...(order.shippingMethod?.trim() ? [`Metode kirim: ${textLine(order.shippingMethod)}`] : []),""] : []),
    ...(order.notes.trim() ? ["*Catatan*",order.notes.trim(),""] : []),
    ...(!cancelled&&bank ? ["*Transfer bank*",`Bank: ${bank.name}`,`No. rekening: ${bank.account}`,`Atas nama: ${bank.holder}`,""] : []),
    ...(cancelled ? ["Pesanan dibatalkan. Tidak ada tagihan untuk pesanan ini."] : footer ? [footer] : []),
  ];
  return lines.join("\n");
}
